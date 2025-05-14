const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const { getChannelDetails, updateChannelInfo, updateChannelBannerImage } = require('../controllers/channelController');
const { protect } = require('../middleware/authmiddleware');

/**
 * @swagger
 * tags:
 *   - name: Channels
 *     description: Endpoints for channel management
 */

/**
 * @swagger
 * /channel/{userId}:
 *   get:
 *     summary: Get a creator's channel details
 *     description: Retrieves details of a creator's channel, including name, profile image, about section, banner image, subscriber count, content, and community posts. Requires authentication.
 *     tags: [Channels]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the creator (user with role 'creator')
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
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                         example: Community Post Title
 *                       content:
 *                         type: string
 *                         example: This is a community post.
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       404:
 *         description: Creator not found
 *       500:
 *         description: Server error
 */
router.route('/:userId').get(protect, getChannelDetails);

/**
 * @swagger
 * /channel/{userId}:
 *   put:
 *     summary: Update creator channel information
 *     description: Updates the creator's channel information (e.g., about section). Only the authenticated creator can update their own channel.
 *     tags: [Channels]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the creator
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
 *             additionalProperties: true
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
 *                 about:
 *                   type: string
 *                   example: Updated channel description
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
 * /channel/{userId}/banner:
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
 *         description: ID of the creator
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
 *         description: No file uploaded
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



