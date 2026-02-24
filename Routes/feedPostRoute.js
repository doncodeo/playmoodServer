const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/feedPostController');
const { protect, optionalProtect, creator } = require('../middleware/authmiddleware');

/**
 * @swagger
 * /api/feed/all:
 *   get:
 *     summary: Get a randomized feed of all creators' posts
 *     tags: [Feed]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: seed
 *         schema:
 *           type: integer
 *         description: Seed for randomizing the feed (optional, for pagination)
 *     responses:
 *       200:
 *         description: A randomized and paginated list of feed items from all creators
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 feed:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - $ref: '#/components/schemas/FeedPostItem'
 *                       - $ref: '#/components/schemas/ThumbnailItem'
 *                       - $ref: '#/components/schemas/ShortPreviewItem'
 *                       - $ref: '#/components/schemas/HighlightItem'
 *                 seed:
 *                   type: integer
 */
router.route('/all').get(getAllCreatorsFeed);

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
 *     FeedPostItem:
 *       allOf:
 *         - $ref: '#/components/schemas/FeedPost'
 *         - type: object
 *           properties:
 *             feedType:
 *               type: string
 *               example: feedPost
 *     ThumbnailItem:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         user:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             profileImage:
 *               type: string
 *         title:
 *           type: string
 *         thumbnail:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         feedType:
 *           type: string
 *           example: thumbnail
 *     ShortPreviewItem:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         user:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             profileImage:
 *               type: string
 *         title:
 *           type: string
 *         shortPreview:
 *           type: object
 *         shortPreviewUrl:
 *           type: string
 *         highlightUrl:
 *           type: string
 *         shortPreviewViews:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         feedType:
 *           type: string
 *           example: shortPreview
 *     HighlightItem:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         user:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             profileImage:
 *               type: string
 *         content:
 *           type: object
 *           properties:
 *             title:
 *               type: string
 *             thumbnail:
 *               type: string
 *         highlightUrl:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         feedType:
 *           type: string
 *           example: highlight
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
 *               key:
 *                 type: string
 *                 example: feed/image123.jpg
 *               provider:
 *                 type: string
 *                 enum: [cloudinary, r2]
 *                 default: cloudinary
 *               thumbnail:
 *                 type: object
 *                 properties:
 *                   url:
 *                     type: string
 *                     example: https://res.cloudinary.com/.../thumbnail.jpg
 *                   public_id:
 *                     type: string
 *                     example: feed_thumbnails/thumbnail123
 *                   key:
 *                     type: string
 *                     example: feed_thumbnails/thumbnail123.jpg
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
 *                     key:
 *                       type: string
 *                     provider:
 *                       type: string
 *                       enum: [cloudinary, r2]
 *                     thumbnail:
 *                       type: object
 *                       properties:
 *                         url:
 *                           type: string
 *                         public_id:
 *                           type: string
 *                         key:
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
 * /api/feed/{id}:
 *   put:
 *     summary: Update a feed post
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
 *               caption:
 *                 type: string
 *               media:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Post updated successfully
 *   delete:
 *     summary: Delete a feed post
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
 *         description: Post deleted successfully
 */
router.route('/:id')
    .put(protect, updateFeedPost)
    .delete(protect, deleteFeedPost);

/**
 * @swagger
 * /api/feed/{id}/comment/{commentId}:
 *   delete:
 *     summary: Delete a comment from a feed post
 *     tags: [Feed]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 */
router.route('/:id/comment/:commentId').delete(protect, deleteFeedPostComment);

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
 *     summary: Get the aggregated feed for a creator
 *     tags: [Feed]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           description: The ID of the creator
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: An aggregated list of feed items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 oneOf:
 *                   - $ref: '#/components/schemas/FeedPostItem'
 *                   - $ref: '#/components/schemas/ThumbnailItem'
 *                   - $ref: '#/components/schemas/ShortPreviewItem'
 *                   - $ref: '#/components/schemas/HighlightItem'
 */
router.route('/user/:userId').get(getCreatorFeed);

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
router.route('/:id/view').put(optionalProtect, viewFeedPost);

module.exports = router;
