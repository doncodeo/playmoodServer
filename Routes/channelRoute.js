const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const { getChannelDetails, updateChannelInfo, updateChannelBannerImage, getAllChannels, getMyChannelDetails, getChannelDetailsByUserName } = require('../controllers/channelController');
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

/**
 * @swagger
 * /username/{userName}:
 *   get:
 *     summary: Get a creator's channel details by username
 *     description: Retrieves details of a creator's channel using their unique username.
 *     tags: [Channels]
 *     parameters:
 *       - in: path
 *         name: userName
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique username of the creator
 *     responses:
 *       200:
 *         description: Creator channel details retrieved successfully
 *       400:
 *         description: Invalid or missing username
 *       404:
 *         description: Creator not found
 *       500:
 *         description: Server error
 */
router.route('/username/:userName').get(getChannelDetailsByUserName);
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
 *               profileImageKey:
 *                 type: string
 *                 example: profiles/65a8025e3af4e7929b379e7b/image.jpg
 *               profileImageProvider:
 *                 type: string
 *                 enum: [cloudinary, r2]
 *               bannerImage:
 *                 type: string
 *                 example: https://res.cloudinary.com/.../new-banner.jpg
 *               bannerImageKey:
 *                 type: string
 *                 example: banners/65a8025e3af4e7929b379e7b/banner.jpg
 *               bannerImageProvider:
 *                 type: string
 *                 enum: [cloudinary, r2]
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
 *     description: Updates the creator's channel banner image. Supports both Cloudinary and R2.
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
 *             required:
 *               - url
 *               - public_id
 *             properties:
 *               url:
 *                 type: string
 *                 description: The new banner image URL
 *                 example: https://res.cloudinary.com/.../banner.jpg
 *               public_id:
 *                 type: string
 *                 description: The public_id of the new banner image (Cloudinary only)
 *                 example: user-uploads/6873bd41369264c373b0373a/mixed/random_id
 *               key:
 *                 type: string
 *                 description: The R2 storage key (R2 only)
 *                 example: banner-images/6873bd41369264c373b0373a/banner.jpg
 *               provider:
 *                 type: string
 *                 enum: [cloudinary, r2]
 *                 default: r2
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
router.route('/:userId/banner').put(protect, updateChannelBannerImage);

/**
 * @swagger
 * /api/channels:
 *   get:
 *     summary: Get all creator channels
 *     description: Retrieves details of all creator channels, including name, profile image, about section, banner image, subscriber count, social media links, and all content created by each creator. Publicly accessible.
 *     tags: [Channels]
 *     responses:
 *       200:
 *         description: All creator channels retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Channels retrieved successfully
 *                 channels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Channel'
 *       404:
 *         description: No creators found
 *       500:
 *         description: Server error
 */
router.route('/').get(getAllChannels);

/**
 * @swagger
 * /api/channel/my-channel/{id}:
 *   get:
 *     summary: Get a creator's channel details
 *     description: Retrieves details of a creator's channel by user ID, including all content (approved and unapproved), subscriber count, and other channel information. Requires authentication; only the user themselves or an admin can access.
 *     tags: [Channels]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the creator
 *     responses:
 *       200:
 *         description: Creator's channel details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: Creator Name
 *                 profileImage:
 *                   type: string
 *                   example: https://example.com/profile.jpg
 *                 about:
 *                   type: string
 *                   example: About the creator
 *                 bannerImage:
 *                   type: string
 *                   example: https://example.com/banner.jpg
 *                 subscribers:
 *                   type: integer
 *                   example: 100
 *                 subscriberDetails:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       name: { type: string }
 *                       profileImage: { type: string }
 *                 content:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Content'
 *                 communityPosts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title: { type: string }
 *                       content: { type: string }
 *                 instagram:
 *                   type: string
 *                   example: https://instagram.com/creator
 *                 tiktok:
 *                   type: string
 *                   example: https://tiktok.com/@creator
 *                 linkedin:
 *                   type: string
 *                   example: https://linkedin.com/in/creator
 *                 twitter:
 *                   type: string
 *                   example: https://twitter.com/creator
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       403:
 *         description: Forbidden - You can only view your own channel or must be an admin
 *       404:
 *         description: Creator not found
 *       500:
 *         description: Server error
 */
router.route('/my-channel/:id').get(protect, getMyChannelDetails);



module.exports = router; 