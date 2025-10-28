const FeedPost = require('../models/feedPostModel');
const User = require('../models/userModel');
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

    const post = await FeedPost.create({
        user: req.user._id,
        caption,
        type,
        media,
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

    const populatedComment = post.comments[post.comments.length - 1];
    await populatedComment.populate('user', 'name profileImage');


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
const getFeedPosts = asyncHandler(async (req, res) => {
    const posts = await FeedPost.find({ user: req.params.userId })
        .populate('user', 'name profileImage')
        .populate('comments.user', 'name profileImage')
        .sort({ createdAt: -1 });

    res.json(posts);
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
    getFeedPosts,
    viewFeedPost,
};
