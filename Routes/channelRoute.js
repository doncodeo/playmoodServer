const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const { getChannelDetails, updateChannelInfo, updateChannelBannerImage } = require('../controllers/channelController');
const { protect } = require('../middleware/authmiddleware');

/**
 * @swagger
 * tags:
 *   name: Channels
 *   description: Endpoints for channel management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Content:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 65a8025e3af4e7929b379e7b
 *         user:
 *           type: string
 *           example: 65a8025e3af4e7929b379e7a
 *         title:
 *           type: string
 *           example: My Awesome Video
 *         category:
 *           type: string
 *           example: Entertainment
 *         description:
 *           type: string
 *           example: A fun video about...
 *         thumbnail:
 *           type: string
 *           example: https://res.cloudinary.com/.../thumbnail.jpg
 *         video:
 *           type: string
 *           example: https://res.cloudinary.com/.../video.mp4
 *         views:
 *           type: number
 *           example: 100
 *         likes:
 *           type: array
 *           items:
 *             type: string
 *             example: 65a8025e3af4e7929b379e7c
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2025-05-14T22:52:00.000Z
 *       required:
 *         - user
 *         - title
 *         - category
 *         - description
 *         - video
 *     CommunityPost:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 65a8025e3af4e7929b379e7d
 *         title:
 *           type: string
 *           example: Community Post Title
 *         content:
 *           type: string
 *           example: This is a community post.
 */

/**
 * @swagger
 * /{userId}:
 *   get:
 *     summary: Get a creator's channel details
 *     description: Retrieves details of a creator's channel, including name, profile image, about section, banner image, subscriber count, social media links, and all content created by the creator. Requires authentication.
 *     tags: [Channels]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the creator
 *     responses:
 *       200:
 *         description: Creator channel details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: John Doe
 *                 profileImage:
 *                   type: string
 *                   example: https://res.cloudinary.com/.../image.jpg
 *                 about:
 *                   type: string
 *                   example: Welcome to my channel!
 *                 bannerImage:
 *                   type: string
 *                   example: https://res.cloudinary.com/.../banner.jpg
 *                 subscribers:
 *                   type: number
 *                   example: 100
 *                 content:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Content'
 *                 communityPosts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CommunityPost'
 *                 instagram:
 *                   type: string
 *                   example: https://instagram.com/johndoe
 *                 tiktok:
 *                   type: string
 *                   example: https://tiktok.com/@johndoe
 *                 linkedin:
 *                   type: string
 *                   example: https://linkedin.com/in/johndoe
 *                 twitter:
 *                   type: string
 *                   example: https://twitter.com/johndoe
 *       400:
 *         description: Invalid or missing user ID
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       404:
 *         description: Creator not found
 *       500:
 *         description: Server error
 */
router.route('/:userId').get(getChannelDetails);

/**
 * @swagger
 * /{userId}:
 *   put:
 *     summary: Update creator channel information
 *     description: Updates the creator's channel information (e.g., about, name, profile image, social media links). Only the authenticated creator can update their own channel.
 *     tags: [Channels]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the creator
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               about:
 *                 type: string
 *                 example: Updated channel description
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               profileImage:
 *                 type: string
 *                 example: https://res.cloudinary.com/.../new-image.jpg
 *               instagram:
 *                 type: string
 *                 example: https://instagram.com/janedoe
 *               tiktok:
 *                 type: string
 *                 example: https://tiktok.com/@janedoe
 *               linkedin:
 *                 type: string
 *                 example: https://linkedin.com/in/janedoe
 *               twitter:
 *                 type: string
 *                 example: https://twitter.com/janedoe
 *             additionalProperties: false
 *     responses:
 *       200:
 *         description: Channel information updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Channel information updated successfully
 *                 name:
 *                   type: string
 *                   example: Jane Doe
 *                 about:
 *                   type: string
 *                   example: Updated channel description
 *                 profileImage:
 *                   type: string
 *                   example: https://res.cloudinary.com/.../new-image.jpg
 *                 instagram:
 *                   type: string
 *                   example: https://instagram.com/janedoe
 *                 tiktok:
 *                   type: string
 *                   example: https://tiktok.com/@janedoe
 *                 linkedin:
 *                   type: string
 *                   example: https://linkedin.com/in/janedoe
 *                 twitter:
 *                   type: string
 *                   example: https://twitter.com/janedoe
 *       400:
 *         description: Invalid or missing user ID
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       403:
 *         description: Forbidden - User is not the creator or lacks permission
 *       404:
 *         description: Creator not found
 *       500:
 *         description: Server error
 */
router.route('/:userId').put(protect, updateChannelInfo);

/**
 * @swagger
 * /{userId}/banner:
 *   put:
 *     summary: Update creator channel banner image
 *     description: Updates the creator's channel banner image by uploading a new image to Cloudinary. Only the authenticated creator can update their own channel.
 *     tags: [Channels]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the creator
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: New banner image file
 *     responses:
 *       200:
 *         description: Channel banner image updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Channel banner image updated successfully
 *                 bannerImage:
 *                   type: string
 *                   example: https://res.cloudinary.com/.../banner.jpg
 *       400:
 *         description: No file uploaded or invalid user ID
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       403:
 *         description: Forbidden - User is not the creator or lacks permission
 *       404:
 *         description: Creator not found
 *       500:
 *         description: Server error
 */
router.route('/:userId/banner').put(protect, upload.single('image'), updateChannelBannerImage);

module.exports = router;