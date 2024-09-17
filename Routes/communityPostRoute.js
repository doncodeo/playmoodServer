const express = require('express');
const router = express.Router();
const {
    createCommunityPost,
    getCommunityPosts,
    updateCommunityPost,
    deleteCommunityPost,
    likeCommunityPost,
    unlikeCommunityPost,
    commentOnCommunityPost,
    deleteComment,
} = require('../controllers/communityPostController');
const { protect } = require('../middleware/authmiddleware');

// @desc    Create a new community post
// @route   POST /api/community-posts
// @access  Private
router.route('/create')
    .post(protect, createCommunityPost);  // Create a new community post

// @desc    Get all community posts for a user
// @route   GET /api/community-posts/:userId
// @access  Public
router.get('/:userId', getCommunityPosts);

// @desc    Update a community post
// @route   PUT /api/community-posts/:postId
// @access  Private
router.route('/:postId')
    .put(protect, updateCommunityPost)   // Update a community post
    .delete(protect, deleteCommunityPost); // Delete a community post

// @desc    Like a community post
// @route   PUT /api/community-posts/:postId/like
// @access  Private
router.put('/:postId/like', protect, likeCommunityPost);

// @desc    Unlike a community post
// @route   PUT /api/community-posts/:postId/unlike
// @access  Private
router.put('/:postId/unlike', protect, unlikeCommunityPost);

// @desc    Add a comment to a community post
// @route   POST /api/community-posts/:postId/comment
// @access  Private
router.post('/:postId/comment', protect, commentOnCommunityPost);

// @desc    Delete a comment from a community post
// @route   DELETE /api/community-posts/:postId/comment/:commentId
// @access  Private
router.delete('/:postId/comment/:commentId', protect, deleteComment);

module.exports = router;
