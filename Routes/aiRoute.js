const express = require('express');
const router = express.Router();
const {
    generateCaptions,
    generateEmbeddings,
    analyzeVideoForModeration,
    moderateComment,
} = require('../controllers/aiController');
const { protect } = require('../middleware/authmiddleware');

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered services for content analysis and generation
 */

/**
 * @swagger
 * /api/ai/generate-captions:
 *   post:
 *     summary: Generate captions for a video
 *     description: Takes a content ID, finds the video, and generates captions for it. This is an asynchronous operation.
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *               - languageCode
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: "65a6fc7b72128447ad32024e"
 *               languageCode:
 *                 type: string
 *                 example: "es"
 *     responses:
 *       200:
 *         description: Captions already exist for the given language
 *       202:
 *         description: Caption generation started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Captions generated successfully
 *                 captions:
 *                   type: string
 *                   example: "This is a transcript of the video."
 *       400:
 *         description: Content ID is required
 *       404:
 *         description: Content not found
 *       500:
 *         description: Failed to generate captions
 */
router.post('/generate-captions', protect, generateCaptions);

/**
 * @swagger
 * /api/ai/generate-embeddings:
 *   post:
 *     summary: Generate embeddings for a piece of content
 *     description: Takes a content ID and generates vector embeddings for the content's metadata.
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: "65a6fc7b72128447ad32024e"
 *     responses:
 *       200:
 *         description: Embeddings generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Embeddings generated successfully
 *                 embeddings:
 *                   type: array
 *                   items:
 *                     type: number
 *       400:
 *         description: Content ID is required
 *       404:
 *         description: Content not found
 *       500:
 *         description: Failed to generate embeddings
 */
router.post('/generate-embeddings', protect, generateEmbeddings);

/**
 * @swagger
 * /api/ai/analyze-video:
 *   post:
 *     summary: Analyze a video for content moderation
 *     description: Takes a content ID, finds the video URL, and analyzes it for moderation.
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: "65a6fc7b72128447ad32024e"
 *     responses:
 *       200:
 *         description: Video analyzed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Video analyzed successfully
 *                 moderationResult:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "approved"
 *                     labels:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Content ID is required
 *       404:
 *         description: Content not found
 *       500:
 *         description: Failed to analyze video
 */
router.post('/analyze-video', protect, analyzeVideoForModeration);

/**
 * @swagger
 * /api/ai/moderate-comment:
 *   post:
 *     summary: Moderate a user-submitted comment
 *     description: Takes a string of text and checks it against moderation rules.
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 example: "This is a user comment."
 *     responses:
 *       200:
 *         description: Comment moderated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Comment moderated successfully
 *                 moderationResult:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "approved"
 *       400:
 *         description: Comment text is required
 *       500:
 *         description: Failed to moderate comment
 */
router.post('/moderate-comment', protect, moderateComment);

module.exports = router;
