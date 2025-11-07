const FeedPost = require('../models/feedPostModel');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const Highlight = require('../models/highlightModel');
const asyncHandler = require('express-async-handler');
const { getWss, sendToUser } = require('../websocket');
const { generateThumbnail } = require('../utils/video');

// @desc    Create a new feed post
// @route   POST /api/feed
// @access  Private (Creator)
const createFeedPost = asyncHandler(async (req, res) => {
    const { caption, type, media } = req.body;

    if (!type || !media || !media.length) {
        res.status(400);
        throw new Error('Please provide a type and at least one media item');
    }

    const processedMedia = await Promise.all(
        media.map(async (item) => {
            if (type === 'video' && !item.thumbnail) {
                try {
                    const secureUrl = item.url.startsWith('http://')
                        ? item.url.replace('http://', 'https://')
                        : item.url;
                    const thumbnail = await generateThumbnail(secureUrl);
                    return { ...item, thumbnail };
                } catch (error) {
                    console.error('Error generating thumbnail:', error);
                    return item; // Proceed without a thumbnail if generation fails
                }
            }
            return item;
        })
    );

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
    const { page = 1, limit = 10 } = req.query;

    const creator = await User.findById(userId);

    if (!creator) {
        res.status(404);
        throw new Error('Creator not found');
    }

    const { feedPosts, thumbnails, shortPreviews, highlights } = creator.feedSettings;
    let combinedFeed = [];

    if (feedPosts) {
        const posts = await FeedPost.find({ user: userId })
            .populate('user', 'name profileImage')
            .populate('comments.user', 'name profileImage')
            .lean();
        combinedFeed.push(...posts.map(p => ({ ...p, feedType: 'feedPost' })));
    }

    if (thumbnails) {
        const contentsWithThumbnails = await Content.find({ user: userId, thumbnail: { $ne: null } })
            .select('user title thumbnail createdAt')
            .populate('user', 'name profileImage')
            .lean();
        combinedFeed.push(...contentsWithThumbnails.map(c => ({ ...c, feedType: 'thumbnail' })));
    }

    if (shortPreviews) {
        const contentsWithPreviews = await Content.find({ user: userId, shortPreview: { $ne: null } })
            .select('user title shortPreview createdAt')
            .populate('user', 'name profileImage')
            .lean();
        combinedFeed.push(...contentsWithPreviews.map(c => ({ ...c, feedType: 'shortPreview' })));
    }

    if (highlights) {
        const userHighlights = await Highlight.find({ user: userId })
            .populate('user', 'name profileImage')
            .populate('content', 'title thumbnail')
            .lean();
        combinedFeed.push(...userHighlights.map(h => ({ ...h, feedType: 'highlight' })));
    }

    // Sort by creation date
    combinedFeed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Paginate
    const paginatedFeed = combinedFeed.slice((page - 1) * limit, page * limit);

    res.json(paginatedFeed);
});

// @desc    Get a randomized feed of all creators' posts
// @route   GET /api/feed/all
// @access  Public
const getAllCreatorsFeed = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, seed: querySeed } = req.query;
    const seed = querySeed ? parseInt(querySeed) : Math.floor(Math.random() * 10000);

    const creators = await User.find({ role: 'creator' }).lean();
    let combinedFeed = [];

    const settingsMap = {
        feedPosts: [],
        thumbnails: [],
        shortPreviews: [],
        highlights: [],
    };

    creators.forEach(creator => {
        if (creator.feedSettings.feedPosts) settingsMap.feedPosts.push(creator._id);
        if (creator.feedSettings.thumbnails) settingsMap.thumbnails.push(creator._id);
        if (creator.feedSettings.shortPreviews) settingsMap.shortPreviews.push(creator._id);
        if (creator.feedSettings.highlights) settingsMap.highlights.push(creator._id);
    });

    if (settingsMap.feedPosts.length > 0) {
        const posts = await FeedPost.find({ user: { $in: settingsMap.feedPosts } })
            .populate('user', 'name profileImage')
            .populate('comments.user', 'name profileImage')
            .lean();
        combinedFeed.push(...posts.map(p => ({ ...p, feedType: 'feedPost' })));
    }
    if (settingsMap.thumbnails.length > 0) {
        const contentsWithThumbnails = await Content.find({ user: { $in: settingsMap.thumbnails }, thumbnail: { $ne: null } })
            .select('user title thumbnail createdAt')
            .populate('user', 'name profileImage')
            .lean();
        combinedFeed.push(...contentsWithThumbnails.map(c => ({ ...c, feedType: 'thumbnail' })));
    }
    if (settingsMap.shortPreviews.length > 0) {
        const contentsWithPreviews = await Content.find({ user: { $in: settingsMap.shortPreviews }, shortPreview: { $ne: null } })
            .select('user title shortPreview createdAt')
            .populate('user', 'name profileImage')
            .lean();
        combinedFeed.push(...contentsWithPreviews.map(c => ({ ...c, feedType: 'shortPreview' })));
    }
    if (settingsMap.highlights.length > 0) {
        const userHighlights = await Highlight.find({ user: { $in: settingsMap.highlights } })
            .populate('user', 'name profileImage')
            .populate('content', 'title thumbnail')
            .lean();
        combinedFeed.push(...userHighlights.map(h => ({ ...h, feedType: 'highlight' })));
    }

    // Seeded shuffle (for consistent pagination)
    let m = combinedFeed.length, t, i;
    let seededRandom = function() {
        var x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };
    while (m) {
        i = Math.floor(seededRandom() * m--);
        t = combinedFeed[m];
        combinedFeed[m] = combinedFeed[i];
        combinedFeed[i] = t;
    }

    // Paginate
    const paginatedFeed = combinedFeed.slice((page - 1) * limit, page * limit);

    res.json({ feed: paginatedFeed, seed });
});

// @desc    Increment view count for a feed post
// @route   PUT /api/feed/:id/view
// @access  Private
const viewFeedPost = asyncHandler(async (req, res) => {
    const post = await FeedPost.findById(req.params.id);

    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }

    const userId = req.user ? req.user._id.toString() : null;
    const ip = req.ip;

    let userHasViewed = false;
    if (userId) {
        userHasViewed = post.viewers.some(viewerId => viewerId.toString() === userId);
    }

    const ipHasViewed = post.viewerIPs.includes(ip);

    if ((userId && !userHasViewed) || (!userId && !ipHasViewed)) {
        if (userId) {
            post.viewers.push(req.user._id);
        }
        if (ip) {
            post.viewerIPs.push(ip);
        }
        await post.save();
    }

    res.json({ message: 'View count updated' });
});

module.exports = {
    createFeedPost,
    likeFeedPost,
    unlikeFeedPost,
    addCommentToFeedPost,
    getCreatorFeed,
    getAllCreatorsFeed,
    viewFeedPost,
};
