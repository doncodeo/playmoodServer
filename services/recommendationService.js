const Content = require('../models/contentModel');
const User = require('../models/userModel');
const LiveProgram = require('../models/liveProgramModel');

const WEIGHTS = {
    LIKE: 50,
    WATCH_STRONG: 30, // >= 70%
    WATCH_MEDIUM: 15, // 30-70%
    REWATCH: 60,
    HOVER: 5,
    COMMENT: 40,
    SHORT_WATCH_PENALTY: -20, // <= 10%
    UNFOLLOW_PENALTY: -100
};

const DECAY_LAMBDA = 0.1; // Halves approx every 7 days

class RecommendationService {
    /**
     * Get personalized recommendations for a user
     * @param {string} userId
     * @param {number} limit
     * @param {object} seedContent Optional content to base recommendations on (related videos)
     */
    async getRecommendations(userId, limit = 10, seedContent = null) {
        // Fetch user and pre-calculate their interest vector if they have history
        const user = userId ? await User.findById(userId).populate('videoProgress.contentId').lean() : null;

        let userVector = null;
        if (user) {
            userVector = this.precalculateUserVector(user);
        }

        // Fetch approved content.
        // Exclude content scheduled for future live programs
        const upcomingPrograms = await LiveProgram.find({
            scheduledStart: { $gt: new Date() }
        }).select('contentId');
        const scheduledContentIds = upcomingPrograms.map(p => p.contentId);

        // OPTIMIZATION: In production, use a more restricted query or vector database.
        // For now, we fetch a limited set of recent/popular content to score to avoid OOM.
        const query = {
            isApproved: true,
            _id: { $nin: scheduledContentIds }
        };
        if (seedContent) {
            query._id = { ...query._id, $ne: seedContent._id };
        }

        // Fetch top 500 recently active items to score, instead of everything.
        // Include fields needed for both scoring and frontend.
        const allContent = await Content.find(query)
            .select('title thumbnail user views createdAt category video description credit likes updatedAt captions shortPreviewUrl shortPreviewViews highlightUrl duration contentEmbedding')
            .sort({ updatedAt: -1 })
            .limit(500)
            .lean();

        if (!user && !seedContent) {
            const topContent = this.getGlobalTopContent(allContent, limit);
            return await Content.populate(topContent, { path: 'user', select: 'name' });
        }

        // Pre-map behavior for faster lookup in the loop
        const behaviorMap = user ? this.createBehaviorMap(user) : null;

        // 2. Calculate scores for each content item
        const scoredContent = allContent.map(content => {
            const score = this.calculateScore(content, user, seedContent, userVector, behaviorMap);

            // Clean up internal fields before returning
            const { contentEmbedding, captions, ...leanContent } = content;
            return { ...leanContent, recommendationScore: score };
        });

        // 3. Sort by score
        scoredContent.sort((a, b) => b.recommendationScore - a.recommendationScore);

        // 4. Apply Diversity Control
        const diverseContent = this.applyDiversity(scoredContent, limit);

        // 5. Populate user field for the final results
        return await Content.populate(diverseContent, { path: 'user', select: 'name' });
    }

    precalculateUserVector(user) {
        const interests = (user.videoProgress || [])
            .filter(p => {
                const percentage = p.contentId && p.contentId.duration ? (p.progress / p.contentId.duration) * 100 : 0;
                return percentage >= 70 ||
                       (user.likes && user.likes.some(id => id.toString() === p.contentId?._id.toString())) ||
                       (user.commentedContent && user.commentedContent.some(c => c.contentId.toString() === p.contentId?._id.toString()));
            })
            .filter(p => p.contentId && p.contentId.contentEmbedding && p.contentId.contentEmbedding.length > 0)
            .map(p => p.contentId.contentEmbedding);

        if (interests.length === 0) return null;

        // Calculate centroid once
        return interests[0].map((_, i) => interests.reduce((acc, vec) => acc + vec[i], 0) / interests.length);
    }

    createBehaviorMap(user) {
        const map = {
            likes: new Set((user.likes || []).map(id => id.toString())),
            progress: {},
            hovers: {},
            unfollows: {},
            comments: {}
        };
        (user.videoProgress || []).forEach(p => {
            if (p.contentId) map.progress[p.contentId._id.toString()] = p;
        });
        (user.hoverHistory || []).forEach(h => {
            if (h.contentId) map.hovers[h.contentId.toString()] = h;
        });
        (user.unfollowedCreators || []).forEach(u => {
            if (u.creatorId) map.unfollows[u.creatorId.toString()] = u;
        });
        (user.commentedContent || []).forEach(c => {
            if (c.contentId) map.comments[c.contentId.toString()] = c;
        });
        return map;
    }

    /**
     * Calculate score for a content item
     */
    calculateScore(content, user, seedContent, userVector, behaviorMap) {
        let score = 0;

        if (behaviorMap) {
            score += this.calculateUserBehaviorScoreFromMap(content, behaviorMap);
        }

        if (seedContent) {
            score += this.calculateContentSimilarityScore(content, seedContent);
        } else if (userVector) {
            score += this.calculateUserInterestSimilarityBoost(content, userVector);
        }

        // --- Popularity & Trending ---
        score += this.calculatePopularityScore(content);

        return score;
    }

    calculateUserBehaviorScoreFromMap(content, behaviorMap) {
        let score = 0;
        const now = new Date();
        const contentIdStr = content._id.toString();

        // 1. Likes
        if (behaviorMap.likes.has(contentIdStr)) {
            score += WEIGHTS.LIKE;
        }

        // 2. Watch Progress & Rewatches
        const progressRecord = behaviorMap.progress[contentIdStr];
        if (progressRecord) {
            const duration = content.duration || 1;
            const percentage = (progressRecord.progress / duration) * 100;

            let watchScore = 0;
            if (percentage >= 70) {
                watchScore = WEIGHTS.WATCH_STRONG;
            } else if (percentage >= 30) {
                watchScore = WEIGHTS.WATCH_MEDIUM;
            } else if (percentage <= 10 && (progressRecord.watchCount || 0) === 0) {
                watchScore = WEIGHTS.SHORT_WATCH_PENALTY;
            }

            const daysSinceWatch = (now - new Date(progressRecord.lastWatchedAt)) / (1000 * 60 * 60 * 24);
            score += watchScore * Math.exp(-DECAY_LAMBDA * daysSinceWatch);

            if (progressRecord.watchCount > 0) {
                score += WEIGHTS.REWATCH * progressRecord.watchCount;
            }
        }

        // 3. Hover History
        const hoverRecord = behaviorMap.hovers[contentIdStr];
        if (hoverRecord) {
            const daysSinceHover = (now - new Date(hoverRecord.hoveredAt)) / (1000 * 60 * 60 * 24);
            score += WEIGHTS.HOVER * Math.exp(-DECAY_LAMBDA * daysSinceHover);
        }

        // 4. Unfollows (within last 30 days)
        const unfollowRecord = behaviorMap.unfollows[content.user.toString()];
        if (unfollowRecord) {
            const daysSinceUnfollow = (now - new Date(unfollowRecord.unfollowedAt)) / (1000 * 60 * 60 * 24);
            if (daysSinceUnfollow <= 30) {
                score += WEIGHTS.UNFOLLOW_PENALTY * (1 - daysSinceUnfollow / 30);
            }
        }

        // 5. Comments
        const commentRecord = behaviorMap.comments[contentIdStr];
        if (commentRecord) {
            const daysSinceComment = (now - new Date(commentRecord.commentedAt)) / (1000 * 60 * 60 * 24);
            score += WEIGHTS.COMMENT * Math.exp(-DECAY_LAMBDA * daysSinceComment);
        }

        return score;
    }

    calculateContentSimilarityScore(content, seedContent) {
        let score = 0;

        // Cosine Similarity via Embeddings
        if (content.contentEmbedding && seedContent.contentEmbedding && content.contentEmbedding.length > 0) {
            const similarity = this.cosineSimilarity(content.contentEmbedding, seedContent.contentEmbedding);
            score += similarity * 50;
        }

        // Metadata matches
        if (content.category === seedContent.category) score += 10;
        if (content.user.toString() === seedContent.user.toString()) score += 15;

        // Language match
        const contentLang = content.captions?.[0]?.languageCode;
        const seedLang = seedContent.captions?.[0]?.languageCode;
        if (contentLang && seedLang && contentLang === seedLang) score += 5;

        return score;
    }

    calculateUserInterestSimilarityBoost(content, userVector) {
        if (content.contentEmbedding && content.contentEmbedding.length > 0) {
            const similarity = this.cosineSimilarity(userVector, content.contentEmbedding);
            return similarity * 40;
        }
        return 0;
    }

    calculatePopularityScore(content) {
        const viewScore = Math.log10(content.views + 1) * 5;
        const ageInDays = (new Date() - new Date(content.createdAt)) / (1000 * 60 * 60 * 24);
        const trendingBoost = (content.views / (ageInDays + 1)) * 0.1;
        return viewScore + Math.min(trendingBoost, 20);
    }

    applyDiversity(scoredContent, limit) {
        const result = [];
        const categoryCount = {};
        const creatorCount = {};

        for (const item of scoredContent) {
            if (result.length >= limit) break;

            const category = item.category;
            const creator = item.user.toString();

            if ((categoryCount[category] || 0) < 3 && (creatorCount[creator] || 0) < 3) {
                result.push(item);
                categoryCount[category] = (categoryCount[category] || 0) + 1;
                creatorCount[creator] = (creatorCount[creator] || 0) + 1;
            }
        }

        if (result.length < limit) {
            for (const item of scoredContent) {
                if (result.length >= limit) break;
                if (!result.find(r => r._id.toString() === item._id.toString())) {
                    result.push(item);
                }
            }
        }

        return result;
    }

    getGlobalTopContent(allContent, limit) {
        const scored = allContent
            .map(content => {
                const { contentEmbedding, captions, ...leanContent } = content;
                return { ...leanContent, recommendationScore: this.calculatePopularityScore(content) };
            })
            .sort((a, b) => b.recommendationScore - a.recommendationScore);

        return this.applyDiversity(scored, limit);
    }

    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0, normA = 0, normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return (normA === 0 || normB === 0) ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

module.exports = new RecommendationService();
