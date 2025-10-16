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

/**
 * @swagger
 * components:
 *   schemas:
 *     CommunityPost:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 65a9fc7b72128447ad32024f
 *         user:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: 65a8025e3af4e7929b379e7b
 *             name:
 *               type: string
 *               example: John Doe
 *             profileImage:
 *               type: string
 *               example: https://res.cloudinary.com/.../image.jpg
 *         content:
 *           type: string
 *           example: This is a community post!
 *         likes:
 *           type: array
 *           items:
 *             type: string
 *           example: ["65a8025e3af4e7929b379e7c"]
 *         comments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 example: 65a9fc7b72128447ad320250
 *               user:
 *                 type: string
 *                 example: 65a8025e3af4e7929b379e7b
 *               content:
 *                 type: string
 *                 example: Great post!
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 example: 2023-01-15T12:00:00Z
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-15T12:00:00Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-15T12:00:00Z
 */

/**
 * @swagger
 * /api/community/create:
 *   post:
 *     summary: Create a new community post
 *     description: Creates a new community post for the authenticated user and adds it to their profile.
 *     tags: [CommunityPosts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 example: This is a community post!
 *                 description: The content of the community post
 *     responses:
 *       201:
 *         description: Community post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityPost'
 *       400:
 *         description: Content is required
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/create').post(protect, createCommunityPost);

/**
 * @swagger
 * /api/community/{userId}:
 *   get:
 *     summary: Get all community posts for a user
 *     description: Retrieves all community posts for a specified user, sorted by timestamp (newest first). Populates post creator and commenter details (name, profileImage).
 *     tags: [CommunityPosts]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user whose posts are to be retrieved
 *     responses:
 *       200:
 *         description: List of community posts
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: private, max-age=300
 *           ETag:
 *             schema:
 *               type: string
 *               example: "community-682fa4973b7d2a9c142724e3-2-1697059200000"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Community posts retrieved successfully
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CommunityPost'
 *       304:
 *         description: Not Modified (ETag match)
 *       400:
 *         description: Invalid user ID format
 *       500:
 *         description: Server error
 */
router.get('/:userId', getCommunityPosts);

/**
 * @swagger
 * /api/community/{postId}:
 *   put:
 *     summary: Update a community post
 *     description: Updates the content of a community post. Only the post's creator can update it.
 *     tags: [CommunityPosts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the community post to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 example: Updated community post content!
 *                 description: The updated content of the community post
 *     responses:
 *       200:
 *         description: Community post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityPost'
 *       400:
 *         description: Content is required
 *       403:
 *         description: Unauthorized action
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
router.route('/:postId').put(protect, updateCommunityPost);

/**
 * @swagger
 * /api/community/{postId}:
 *   delete:
 *     summary: Delete a community post
 *     description: Deletes a community post and removes it from the user's profile. Only the post's creator can delete it.
 *     tags: [CommunityPosts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the community post to delete
 *     responses:
 *       200:
 *         description: Community post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post deleted successfully
 *       403:
 *         description: Unauthorized action
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
router.route('/:postId').delete(protect, deleteCommunityPost);

/**
 * @swagger
 * /api/community/{postId}/like:
 *   put:
 *     summary: Like a community post
 *     description: Adds the authenticated user's ID to the likes array of a community post.
 *     tags: [CommunityPosts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the community post to like
 *     responses:
 *       200:
 *         description: Community post liked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityPost'
 *       400:
 *         description: You have already liked this post
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
router.put('/:postId/like', protect, likeCommunityPost);

/**
 * @swagger
 * /api/community/{postId}/unlike:
 *   put:
 *     summary: Unlike a community post
 *     description: Removes the authenticated user's ID from the likes array of a community post.
 *     tags: [CommunityPosts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the community post to unlike
 *     responses:
 *       200:
 *         description: Community post unliked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityPost'
 *       400:
 *         description: You have not liked this post
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
router.put('/:postId/unlike', protect, unlikeCommunityPost);

/**
 * @swagger
 * /api/community/{postId}/comment:
 *   post:
 *     summary: Add a comment to a community post
 *     description: Adds a comment by the authenticated user to a community post.
 *     tags: [CommunityPosts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the community post to comment on
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 example: Great post!
 *                 description: The content of the comment
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityPost'
 *       400:
 *         description: Comment content is required
 *       404:
 *         description: Post not found
 *       500:
 *         description: Server error
 */
router.post('/:postId/comment', protect, commentOnCommunityPost);

/**
 * @swagger
 * /api/community/{postId}/comment/{commentId}:
 *   delete:
 *     summary: Delete a comment from a community post
 *     description: Deletes a comment from a community post. Only the comment's creator can delete it.
 *     tags: [CommunityPosts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the community post
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the comment to delete
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Comment deleted successfully
 *       403:
 *         description: Unauthorized action
 *       404:
 *         description: Post or comment not found
 *       500:
 *         description: Server error
 */
router.delete('/:postId/comment/:commentId', protect, deleteComment);

module.exports = router;




// const express = require('express');
// const router = express.Router();
// const {
//     createCommunityPost,
//     getCommunityPosts,
//     updateCommunityPost,
//     deleteCommunityPost,
//     likeCommunityPost,
//     unlikeCommunityPost,
//     commentOnCommunityPost,
//     deleteComment,
// } = require('../controllers/communityPostController');
// const { protect } = require('../middleware/authmiddleware');

// // @desc    Create a new community post
// // @route   POST /api/community-posts
// // @access  Private
// router.route('/create')
//     .post(protect, createCommunityPost);  // Create a new community post

// // @desc    Get all community posts for a user
// // @route   GET /api/community-posts/:userId
// // @access  Public
// router.get('/:userId', getCommunityPosts);

// // @desc    Update a community post
// // @route   PUT /api/community-posts/:postId
// // @access  Private
// router.route('/:postId')
//     .put(protect, updateCommunityPost)   // Update a community post
//     .delete(protect, deleteCommunityPost); // Delete a community post

// // @desc    Like a community post
// // @route   PUT /api/community-posts/:postId/like
// // @access  Private
// router.put('/:postId/like', protect, likeCommunityPost);

// // @desc    Unlike a community post
// // @route   PUT /api/community-posts/:postId/unlike
// // @access  Private
// router.put('/:postId/unlike', protect, unlikeCommunityPost);

// // @desc    Add a comment to a community post
// // @route   POST /api/community-posts/:postId/comment
// // @access  Private
// router.post('/:postId/comment', protect, commentOnCommunityPost);

// // @desc    Delete a comment from a community post
// // @route   DELETE /api/community-posts/:postId/comment/:commentId
// // @access  Private
// router.delete('/:postId/comment/:commentId', protect, deleteComment);

// module.exports = router;
