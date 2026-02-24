const FeedPost = require('../models/feedPostModel');
const FeedPostView = require('../models/feedPostViewModel');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const Highlight = require('../models/highlightModel');
const LiveProgram = require('../models/liveProgramModel');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const { getWss, sendToUser } = require('../websocket');
// @desc    Create a new feed post
// @route   POST /api/feed
// @access  Private (Creator)
const createFeedPost = asyncHandler(async (req, res) => {
    const { caption, type, media } = req.body;

    if (!type || !media || !media.length) {
        res.status(400);
        throw new Error('Please provide a type and at least one media item');
    }

    const processedMedia = media.map(item => {
        // Enforce HTTPS
        if (item.url) {
            item.url = item.url.replace(/^http:\/\//i, 'https://');
        }
        if (item.thumbnail && item.thumbnail.url) {
            item.thumbnail.url = item.thumbnail.url.replace(/^http:\/\//i, 'https://');
        }

        const provider = item.provider || 'cloudinary';

        if (type === 'video' && !item.thumbnail && provider === 'cloudinary' && item.public_id) {
            const thumbnailUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_1/${item.public_id}.jpg`;
            return {
                ...item,
                provider,
                thumbnail: {
                    url: thumbnailUrl,
                    public_id: ''
                }
            };
        }
        return { ...item, provider };
    });

    const post = await FeedPost.create({
        user: req.user._id,
        caption,
        type,
        media: processedMedia,
    });

    res.status(201).json(post);
});

// @desc    Like a feed post
// @route   PUT /api/feed/:id/like
// @access  Private
const likeFeedPost = asyncHandler(async (req, res) => {
    const post = await FeedPost.findById(req.params.id);

    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }

    if (post.likes.includes(req.user._id)) {
        res.status(400);
        throw new Error('You have already liked this post');
    }

    post.likes.push(req.user._id);
    await post.save();

    // Broadcast WebSocket event
    getWss().clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                event: 'feed_post_liked',
                postId: post._id,
                userId: req.user._id
            }));
        }
    });

    res.json({ message: 'Post liked successfully' });
});

// @desc    Unlike a feed post
// @route   PUT /api/feed/:id/unlike
// @access  Private
const unlikeFeedPost = asyncHandler(async (req, res) => {
    const post = await FeedPost.findById(req.params.id);

    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }

    if (!post.likes.includes(req.user._id)) {
        res.status(400);
        throw new Error('You have not liked this post');
    }

    post.likes = post.likes.filter(like => like.toString() !== req.user._id.toString());
    await post.save();

     // Broadcast WebSocket event
     getWss().clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                event: 'feed_post_unliked',
                postId: post._id,
                userId: req.user._id
            }));
        }
    });

    res.json({ message: 'Post unliked successfully' });
});

// @desc    Add a comment to a feed post
// @route   POST /api/feed/:id/comment
// @access  Private
const addCommentToFeedPost = asyncHandler(async (req, res) => {
    const { text } = req.body;
    const post = await FeedPost.findById(req.params.id);

    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }

    const comment = {
        user: req.user._id,
        text,
    };

    post.comments.push(comment);
    await post.save();

    await post.populate({
        path: 'comments.user',
        select: 'name profileImage',
    });
    const populatedComment = post.comments[post.comments.length - 1];


    // Broadcast WebSocket event
    getWss().clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                event: 'feed_post_comment_added',
                postId: post._id,
                comment: populatedComment
            }));
        }
    });

    res.status(201).json(populatedComment);
});

// @desc    Get feed posts for a user
// @route   GET /api/feed/user/:userId
// @access  Public
const getCreatorFeed = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const pageNum = parseInt(req.query.page) || 1;
    const limitNum = parseInt(req.query.limit) || 10;
    const skipNum = (pageNum - 1) * limitNum;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400);
        throw new Error('Invalid user ID');
    }

    const creator = await User.findById(userId);

    if (!creator) {
        res.status(404);
        throw new Error('Creator not found');
    }

    const { feedPosts, thumbnails, shortPreviews, highlights } = creator.feedSettings || {
        feedPosts: true,
        thumbnails: true,
        shortPreviews: true,
        highlights: true
    };

    // Exclude content scheduled for future live programs
    const upcomingPrograms = await LiveProgram.find({
        scheduledStart: { $gt: new Date() }
    }).select('contentId');
    const scheduledContentIds = upcomingPrograms.map(p => p.contentId);

    const pipeline = [];

    // We need a base collection to start the aggregation.
    // If feedPosts is enabled, we start with FeedPost.
    // Otherwise, we use an empty array match on FeedPost or another collection.

    let baseCollection = FeedPost;
    let baseMatch = { user: new mongoose.Types.ObjectId(userId) };

    if (feedPosts) {
        pipeline.push({ $match: baseMatch });
        pipeline.push({ $addFields: { feedType: 'feedPost' } });
    } else {
        // If feedPosts is disabled, start with an empty result set
        pipeline.push({ $match: { _id: null } });
    }

    if (thumbnails) {
        pipeline.push({
            $unionWith: {
                coll: 'contents',
                pipeline: [
                    {
                        $match: {
                            user: new mongoose.Types.ObjectId(userId),
                            isApproved: true,
                            thumbnail: { $ne: null },
                            _id: { $nin: scheduledContentIds }
                        }
                    },
                    { $addFields: { feedType: 'thumbnail' } },
                    { $project: { user: 1, title: 1, thumbnail: 1, createdAt: 1, feedType: 1 } }
                ]
            }
        });
    }

    if (shortPreviews) {
        pipeline.push({
            $unionWith: {
                coll: 'contents',
                pipeline: [
                    {
                        $match: {
                            user: new mongoose.Types.ObjectId(userId),
                            isApproved: true,
                            shortPreview: { $ne: null },
                            _id: { $nin: scheduledContentIds }
                        }
                    },
                    { $addFields: { feedType: 'shortPreview' } },
                    { $project: { user: 1, title: 1, shortPreview: 1, shortPreviewUrl: 1, shortPreviewViews: 1, highlightUrl: 1, createdAt: 1, feedType: 1 } }
                ]
            }
        });
    }

    if (highlights) {
        pipeline.push({
            $unionWith: {
                coll: 'highlights',
                pipeline: [
                    {
                        $match: {
                            user: new mongoose.Types.ObjectId(userId),
                            content: { $nin: scheduledContentIds }
                        }
                    },
                    { $addFields: { feedType: 'highlight' } }
                ]
            }
        });
    }

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skipNum });
    pipeline.push({ $limit: limitNum });

    // Populate user and other details
    const feedItems = await FeedPost.aggregate(pipeline);

    // Manual population since we used aggregate
    const populatedFeed = await FeedPost.populate(feedItems, [
        { path: 'user', select: 'name profileImage' },
        { path: 'comments.user', select: 'name profileImage' },
        { path: 'content', select: 'title thumbnail', model: 'Contents' } // Fixed: Specify model for content
    ]);

    res.json(populatedFeed);
});

// @desc    Get a randomized feed of all creators' posts
// @route   GET /api/feed/all
// @access  Public
const getAllCreatorsFeed = asyncHandler(async (req, res) => {
    const pageNum = parseInt(req.query.page) || 1;
    const limitNum = parseInt(req.query.limit) || 10;
    const { seed: querySeed } = req.query;
    const seed = querySeed ? parseInt(querySeed) : Math.floor(Math.random() * 10000);

    // To ensure scalability, we limit the number of items we fetch for the randomized pool.
    // A real-world application might use a dedicated feed service or more complex caching.
    const POOL_LIMIT = 1000;

    const creators = await User.find({ role: 'creator' }).select('_id feedSettings').lean();

    const settingsMap = {
        feedPosts: [],
        thumbnails: [],
        shortPreviews: [],
        highlights: [],
    };

    creators.forEach(creator => {
        const settings = creator.feedSettings || { feedPosts: true, thumbnails: true, shortPreviews: true, highlights: true };
        if (settings.feedPosts) settingsMap.feedPosts.push(creator._id);
        if (settings.thumbnails) settingsMap.thumbnails.push(creator._id);
        if (settings.shortPreviews) settingsMap.shortPreviews.push(creator._id);
        if (settings.highlights) settingsMap.highlights.push(creator._id);
    });

    // Exclude content scheduled for future live programs
    const upcomingPrograms = await LiveProgram.find({
        scheduledStart: { $gt: new Date() }
    }).select('contentId');
    const scheduledContentIds = upcomingPrograms.map(p => p.contentId);

    const pipeline = [];

    // Start with FeedPosts from all relevant creators
    if (settingsMap.feedPosts.length > 0) {
        pipeline.push({ $match: { user: { $in: settingsMap.feedPosts } } });
        pipeline.push({ $addFields: { feedType: 'feedPost' } });
    } else {
        pipeline.push({ $match: { _id: null } });
    }

    if (settingsMap.thumbnails.length > 0) {
        pipeline.push({
            $unionWith: {
                coll: 'contents',
                pipeline: [
                    {
                        $match: {
                            user: { $in: settingsMap.thumbnails },
                            isApproved: true,
                            thumbnail: { $ne: null },
                            _id: { $nin: scheduledContentIds }
                        }
                    },
                    { $addFields: { feedType: 'thumbnail' } },
                    { $project: { user: 1, title: 1, thumbnail: 1, createdAt: 1, feedType: 1 } }
                ]
            }
        });
    }

    if (settingsMap.shortPreviews.length > 0) {
        pipeline.push({
            $unionWith: {
                coll: 'contents',
                pipeline: [
                    {
                        $match: {
                            user: { $in: settingsMap.shortPreviews },
                            isApproved: true,
                            shortPreview: { $ne: null },
                            _id: { $nin: scheduledContentIds }
                        }
                    },
                    { $addFields: { feedType: 'shortPreview' } },
                    { $project: { user: 1, title: 1, shortPreview: 1, shortPreviewUrl: 1, shortPreviewViews: 1, highlightUrl: 1, createdAt: 1, feedType: 1 } }
                ]
            }
        });
    }

    if (settingsMap.highlights.length > 0) {
        pipeline.push({
            $unionWith: {
                coll: 'highlights',
                pipeline: [
                    {
                        $match: {
                            user: { $in: settingsMap.highlights },
                            content: { $nin: scheduledContentIds }
                        }
                    },
                    { $addFields: { feedType: 'highlight' } }
                ]
            }
        });
    }

    // Fetch the pool of items (e.g., 1000 most recent items across all types)
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $limit: POOL_LIMIT });

    let combinedFeed = await FeedPost.aggregate(pipeline);

    // Group content by creator for intelligent shuffle
    const contentByCreator = {};
    combinedFeed.forEach(item => {
        const creatorId = item.user.toString();
        if (!contentByCreator[creatorId]) {
            contentByCreator[creatorId] = [];
        }
        contentByCreator[creatorId].push(item);
    });

    // Use the seed for deterministic shuffling (pseudo-random based on seed)
    const seededRandom = (s) => {
        const x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    };

    const creatorIds = Object.keys(contentByCreator);
    const shuffledFeed = [];
    let lastCreatorId = null;
    let currentSeed = seed;

    // Intelligent shuffle to avoid consecutive posts from the same creator
    while (shuffledFeed.length < combinedFeed.length) {
        let availableCreators = creatorIds.filter(id => contentByCreator[id].length > 0 && id !== lastCreatorId);
        if (availableCreators.length === 0) {
            availableCreators = creatorIds.filter(id => contentByCreator[id].length > 0);
        }

        if (availableCreators.length === 0) break;

        // Deterministic random choice based on seed
        const randomIndex = Math.floor(seededRandom(currentSeed++) * availableCreators.length);
        const randomCreatorId = availableCreators[randomIndex];

        const contentIndex = Math.floor(seededRandom(currentSeed++) * contentByCreator[randomCreatorId].length);
        shuffledFeed.push(contentByCreator[randomCreatorId][contentIndex]);
        contentByCreator[randomCreatorId].splice(contentIndex, 1);
        lastCreatorId = randomCreatorId;
    }

    // Paginate
    const paginatedFeedItems = shuffledFeed.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Populate the paginated results
    const populatedFeed = await FeedPost.populate(paginatedFeedItems, [
        { path: 'user', select: 'name profileImage' },
        { path: 'comments.user', select: 'name profileImage' },
        { path: 'content', select: 'title thumbnail', model: 'Contents' } // Fixed: Specify model for content
    ]);

    res.json({ feed: populatedFeed, seed });
});

// @desc    Increment view count for a feed post
// @route   PUT /api/feed/:id/view
// @access  Public
const viewFeedPost = asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const userId = req.user ? req.user._id : null;
    const ip = req.ip;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400);
        throw new Error('Invalid post ID');
    }

    const post = await FeedPost.findById(postId);
    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }

    let alreadyViewed = false;

    try {
        if (userId) {
            // Check if user has viewed
            const existingView = await FeedPostView.findOne({ post: postId, user: userId });
            if (!existingView) {
                await FeedPostView.create({ post: postId, user: userId, ip });
                alreadyViewed = false;
            } else {
                alreadyViewed = true;
            }
        } else {
            // Check if IP has viewed (for anonymous users)
            const existingView = await FeedPostView.findOne({ post: postId, ip: ip, user: { $exists: false } });
            if (!existingView) {
                await FeedPostView.create({ post: postId, ip });
                alreadyViewed = false;
            } else {
                alreadyViewed = true;
            }
        }
    } catch (error) {
        // Handle race conditions from unique index
        if (error.code === 11000) {
            alreadyViewed = true;
        } else {
            throw error;
        }
    }

    if (!alreadyViewed) {
        await FeedPost.findByIdAndUpdate(postId, { $inc: { views: 1 } });
    }

    res.json({ message: 'View tracked' });
});

// @desc    Update a feed post
// @route   PUT /api/feed/:id
// @access  Private (Owner)
const updateFeedPost = asyncHandler(async (req, res) => {
    const { caption, media } = req.body;
    const post = await FeedPost.findById(req.params.id);

    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }

    if (post.user.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to update this post');
    }

    if (caption) post.caption = caption;
    if (media) {
        post.media = media.map(item => {
            if (item.url) {
                item.url = item.url.replace(/^http:\/\//i, 'https://');
            }
            if (item.thumbnail && item.thumbnail.url) {
                item.thumbnail.url = item.thumbnail.url.replace(/^http:\/\//i, 'https://');
            }
            return item;
        });
    }

    const updatedPost = await post.save();
    res.json(updatedPost);
});

// @desc    Delete a feed post
// @route   DELETE /api/feed/:id
// @access  Private (Owner/Admin)
const deleteFeedPost = asyncHandler(async (req, res) => {
    const post = await FeedPost.findById(req.params.id);

    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }

    if (post.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('Not authorized to delete this post');
    }

    await FeedPost.findByIdAndDelete(req.params.id);
    await FeedPostView.deleteMany({ post: req.params.id });
    res.json({ message: 'Post removed successfully' });
});

// @desc    Delete a comment from a feed post
// @route   DELETE /api/feed/:id/comment/:commentId
// @access  Private (Owner of comment/post or Admin)
const deleteFeedPostComment = asyncHandler(async (req, res) => {
    const post = await FeedPost.findById(req.params.id);

    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
        res.status(404);
        throw new Error('Comment not found');
    }

    const isCommentOwner = comment.user.toString() === req.user._id.toString();
    const isPostOwner = post.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCommentOwner && !isPostOwner && !isAdmin) {
        res.status(403);
        throw new Error('Not authorized to delete this comment');
    }

    post.comments.pull(req.params.commentId);
    await post.save();

    res.json({ message: 'Comment removed successfully' });
});

module.exports = {
    createFeedPost,
    updateFeedPost,
    deleteFeedPost,
    likeFeedPost,
    unlikeFeedPost,
    addCommentToFeedPost,
    deleteFeedPostComment,
    getCreatorFeed,
    getAllCreatorsFeed,
    viewFeedPost,
};
