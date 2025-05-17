const express = require('express');
const router = express.Router();
const { 
    subscribe, 
    unsubscribe, 
    getSubscribedContent, 
    getSubscribers 
} = require('../controllers/subscribeController');
const { protect } = require('../middleware/authmiddleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     Subscription:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 65a9fc7b72128447ad32024f
 *         subscriber:
 *           type: string
 *           example: 65a8025e3af4e7929b379e7b
 *         creator:
 *           type: string
 *           example: 65a8025e3af4e7929b379e7c
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-15T12:00:00Z
 *     Subscriber:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 65a8025e3af4e7929b379e7b
 *         name:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           example: john@example.com
 *         profileImage:
 *           type: string
 *           example: https://res.cloudinary.com/.../image.jpg
 */

/**
 * @swagger
 * /api/subscribe:
 *   post:
 *     summary: Subscribe to a creator
 *     description: Subscribes the authenticated user to a creator, updating both user profiles with subscription details.
 *     tags: [Subscriptions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               creatorId:
 *                 type: string
 *                 example: 65a8025e3af4e7929b379e7c
 *                 description: ID of the creator to subscribe to
 *     responses:
 *       201:
 *         description: Subscribed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Subscribed successfully.
 *       400:
 *         description: Already subscribed to this creator
 *       500:
 *         description: Server error
 */
router.route('/').post(protect, subscribe); 

/**
 * @swagger
 * /api/subscribe:
 *   put:
 *     summary: Unsubscribe from a creator
 *     description: Unsubscribes the authenticated user from a creator, updating both user profiles.
 *     tags: [Subscriptions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               creatorId:
 *                 type: string
 *                 example: 65a8025e3af4e7929b379e7c
 *                 description: ID of the creator to unsubscribe from
 *     responses:
 *       200:
 *         description: Unsubscribed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unsubscribed successfully.
 *       400:
 *         description: Not subscribed to this creator or missing creator ID
 *       500:
 *         description: Server error
 */
router.route('/').put(protect, unsubscribe);

/**
 * @swagger
 * /api/subscribe/content:
 *   get:
 *     summary: Get content from subscribed creators
 *     description: Retrieves all content created by creators the authenticated user is subscribed to.
 *     tags: [Subscriptions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of content from subscribed creators
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Content'
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/content').get(protect, getSubscribedContent);

/**
 * @swagger
 * /api/subscribe/subscribers:
 *   get:
 *     summary: Get all subscribers of a creator
 *     description: Retrieves a list of subscribers for the authenticated creator, including their name, email, and profile image.
 *     tags: [Subscriptions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of subscribers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Subscriber'
 *       404:
 *         description: Creator not found
 *       500:
 *         description: Server error
 */
router.route('/subscribers').get(protect, getSubscribers);

module.exports = router;













// const express = require('express');
// const router = express.Router();
// const { 
//     subscribe, 
//     unsubscribe, 
//     getSubscribedContent, 
//     getSubscribers 
// } = require('../controllers/subscribeController');
// const { protect } = require('../middleware/authmiddleware');

// // Subscribe and unsubscribe using the root route
// router.route('/')
//     .post(protect, subscribe)     // Subscribe to a creator
//     .put(protect, unsubscribe);  // Unsubscribe from a creator

// // Fetch content from subscribed creators
// router.route('/content')
//     .get(protect, getSubscribedContent);

// // Fetch all subscribers for a creator
// router.route('/subscribers')
//     .get(protect, getSubscribers);

// module.exports = router;


