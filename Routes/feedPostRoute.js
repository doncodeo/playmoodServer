const express = require('express');
const router = express.Router();
const {
    createFeedPost,
    likeFeedPost,
    unlikeFeedPost,
    addCommentToFeedPost,
    getFeedPosts,
    viewFeedPost,
} = require('../controllers/feedPostController');
const { protect, creator } = require('../middleware/authmiddleware');

/**
 * @swagger
 * tags:
 *   name: Feed
 *   description: API for the Creator's Feed
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     FeedPost:
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
 *         caption:
 *           type: string
 *           example: This is a feed post!
 *         type:
 *           type: string
 *           enum: [image, video]
 *           example: image
 *         media:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 example: https://res.cloudinary.com/.../image.jpg
 *               public_id:
 *                 type: string
 *                 example: feed/image123
 *               thumbnail:
 *                 type: object
 *                 properties:
 *                   url:
 *                     type: string
 *                     example: https://res.cloudinary.com/.../thumbnail.jpg
 *                   public_id:
 *                     type: string
 *                     example: feed_thumbnails/thumbnail123
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
 *               text:
 *                 type: string
 *                 example: Great post!
 *               createdAt:
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
 * /api/feed:
 *   post:
 *     summary: Create a new feed post
 *     tags: [Feed]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               caption:
 *                 type: string
 *                 example: Check out my new photos!
 *               type:
 *                 type: string
 *                 enum: [image, video]
 *                 example: image
 *               media:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     public_id:
 *                       type: string
 *                     thumbnail:
 *                       type: object
 *                       properties:
 *                         url:
 *                           type: string
 *                         public_id:
 *                           type: string
 *     responses:
 *       201:
 *         description: Feed post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedPost'
 */
router.route('/').post(protect, creator, createFeedPost);

/**
 * @swagger
 * /api/feed/{id}/like:
 *   put:
 *     summary: Like a feed post
 *     tags: [Feed]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post liked successfully
 */
router.route('/:id/like').put(protect, likeFeedPost);

/**
 * @swagger
 * /api/feed/{id}/unlike:
 *   put:
 *     summary: Unlike a feed post
 *     tags: [Feed]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post unliked successfully
 */
router.route('/:id/unlike').put(protect, unlikeFeedPost);

/**
 * @swagger
 * /api/feed/{id}/comment:
 *   post:
 *     summary: Add a comment to a feed post
 *     tags: [Feed]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 example: Awesome post!
 *     responses:
 *       201:
 *         description: Comment added successfully
 */
router.route('/:id/comment').post(protect, addCommentToFeedPost);

/**
 * @swagger
 * /api/feed/user/{userId}:
 *   get:
 *     summary: Get all feed posts for a user
 *     tags: [Feed]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of feed posts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FeedPost'
 */
router.route('/user/:userId').get(getFeedPosts);

/**
 * @swagger
 * /api/feed/{id}/view:
 *   put:
 *     summary: Increment the view count for a feed post
 *     tags: [Feed]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: View count updated
 */
router.route('/:id/view').put(viewFeedPost);

module.exports = router;
