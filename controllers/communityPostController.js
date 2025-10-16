const asyncHandler = require('express-async-handler');
const CommunityPost = require('../models/communityPostModel');
const User = require('../models/userModel');
const mongoose = require('mongoose');
const { getWss } = require('../websocket');
const WebSocket = require('ws');


// @desc    Create a new community post
// @route   POST /api/community-posts
// @access  Private
const createCommunityPost = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const userId = req.user.id;

    try {
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const newPost = await CommunityPost.create({
            user: userId,
            content,
        });

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.communityPosts.push(newPost._id);
        await user.save();

        res.status(201).json(newPost);
    } catch (error) { 
        res.status(500).json({ error: 'Server error: Unable to create post' });
    }
});

// @desc    Get all community posts for a user
// @route   GET /api/community-posts/:userId
// @access  Public
const getCommunityPosts = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    console.log('Requested userId for community posts:', userId); // Debug

    // Validate userId format 
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid userId format:', userId);
        return res.status(400).json({ error: 'Invalid user ID format' });
    }

    try {
        // Fetch posts directly from CommunityPost collection
        const posts = await CommunityPost.find({ user: userId })
            .sort({ timestamp: -1 }) // Sort by newest first
            .populate('user', 'name profileImage') // Populate post creator
            .populate({
                path: 'comments.user',
                select: 'name profileImage', // Populate commenter details
            });

        console.log('Community posts count:', posts.length); // Debug

        // Generate ETag
        const lastCreated = posts.length > 0 ? posts[0].timestamp.getTime() : 0;
        const etag = `"community-${userId}-${posts.length}-${lastCreated}"`;

        if (req.get('If-None-Match') === etag) {
            return res.status(304).end();
        }

        res.set({
            'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
            'ETag': etag,
        });

        res.status(200).json({
            message: posts.length > 0 ? 'Community posts retrieved successfully' : 'No community posts found',
            posts: posts || [],
        });
    } catch (error) {
        console.error('Get community posts error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid data detected', details: error.message });
        }
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

// @desc    Update a community post
// @route   PUT /api/community-posts/:postId
// @access  Private
const updateCommunityPost = asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    try {
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const post = await CommunityPost.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (post.user.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized action' });
        }

        post.content = content;
        await post.save();

        res.status(200).json(post);
    } catch (error) {
        res.status(500).json({ error: 'Server error: Unable to update post' });
    }
});

// @desc    Delete a community post
// @route   DELETE /api/community-posts/:postId
// @access  Private
const deleteCommunityPost = asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user.id;

    try {
        const post = await CommunityPost.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (post.user.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized action' });
        }

        await post.remove();

        const user = await User.findById(userId);
        if (user) {
            user.communityPosts = user.communityPosts.filter(
                (post) => post.toString() !== postId
            );
            await user.save();
        }

        res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error: Unable to delete post' });
    }
});

// @desc    Like a community post
// @route   PUT /api/community-posts/:postId/like
// @access  Private
const likeCommunityPost = asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user.id;

    try {
        const post = await CommunityPost.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (post.likes.includes(userId)) {
            return res.status(400).json({ error: 'You have already liked this post' });
        }

        post.likes.push(userId); 
        await post.save();

        const wss = getWss();
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    event: 'community_post_liked',
                    payload: {
                        postId: postId,
                        likes: post.likes.length,
                    },
                }));
            }
        });

        res.status(200).json(post);
    } catch (error) {
        res.status(500).json({ error: 'Server error: Unable to like post' });
    }
});

// @desc    Unlike a community post
// @route   PUT /api/community-posts/:postId/unlike
// @access  Private
const unlikeCommunityPost = asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user.id;

    try {
        const post = await CommunityPost.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (!post.likes.includes(userId)) {
            return res.status(400).json({ error: 'You have not liked this post' });
        }

        post.likes = post.likes.filter((like) => like.toString() !== userId);
        await post.save();

        const wss = getWss();
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    event: 'community_post_unliked',
                    payload: {
                        postId: postId,
                        likes: post.likes.length,
                    },
                }));
            }
        });

        res.status(200).json(post);
    } catch (error) {
        res.status(500).json({ error: 'Server error: Unable to unlike post' });
    }
});

// @desc    Add a comment to a community post
// @route   POST /api/community-posts/:postId/comment
// @access  Private
const commentOnCommunityPost = asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    try {
        if (!content) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        const post = await CommunityPost.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const newComment = {
            user: userId,
            content,
            timestamp: Date.now(),
        };

        post.comments.push(newComment);
        await post.save();

        const wss = getWss();
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    event: 'community_post_comment_added',
                    payload: {
                        postId: postId,
                        comment: newComment,
                    },
                }));
            }
        });

        res.status(201).json(post);
    } catch (error) {
        res.status(500).json({ error: 'Server error: Unable to add comment' });
    }
});

// @desc    Delete a comment from a community post
// @route   DELETE /api/community-posts/:postId/comment/:commentId
// @access  Private
const deleteComment = asyncHandler(async (req, res) => {
    const { postId, commentId } = req.params;
    const userId = req.user.id;

    try {
        const post = await CommunityPost.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const comment = post.comments.find((c) => c._id.toString() === commentId);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        if (comment.user.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized action' });
        }

        post.comments = post.comments.filter((c) => c._id.toString() !== commentId);
        await post.save();

        res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error: Unable to delete comment' });
    }
});

module.exports = {
    createCommunityPost,
    getCommunityPosts,
    updateCommunityPost,
    deleteCommunityPost,
    likeCommunityPost,
    unlikeCommunityPost,
    commentOnCommunityPost,
    deleteComment,
};
