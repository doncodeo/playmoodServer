const express = require('express');
const router = express.Router();
const {
    generateCaptions,
    generateEmbeddings,
    analyzeVideoForModeration,
    moderateComment,
    translateVideo,
    processPendingTranslations,
    getSupportedLanguages,
    getSupportedTranscriptionLanguages,
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
 *         description: Caption generation has been queued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Caption generation for language 'es' has been queued."
 *       400:
 *         description: Content ID or language code is required
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

/**
 * @swagger
 * /api/ai/translate-video:
 *   post:
 *     summary: Translate a video to a different language
 *     description: Takes a content ID and a target language, then translates the video.
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
 *               - language
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: "65a6fc7b72128447ad32024e"
 *               language:
 *                 type: string
 *                 example: "Spanish"
 *     responses:
 *       201:
 *         description: Video translation initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Video translation to 'Spanish' initiated successfully."
 *                 videoTranslateId:
 *                   type: string
 *                   example: "e00b00a17bbc4b85ae3c6b18a8efc735"
 *       400:
 *         description: Content ID and language are required
 *       404:
 *         description: Content not found
 *       409:
 *         description: A translation for this language already exists or is in progress
 *       500:
 *         description: Failed to start video translation
 */
router.post('/translate-video', protect, translateVideo);

/**
 * @swagger
 * /api/ai/process-translations:
 *   post:
 *     summary: Process pending video translations
 *     description: Scans for pending translations, checks their status, and processes them if they are complete.
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Translation processing finished
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 processed:
 *                   type: integer
 *                 success:
 *                   type: integer
 *                 failed:
 *                   type: integer
 *       500:
 *         description: An error occurred during processing
 */
router.post('/process-translations', protect, processPendingTranslations);

// TEMP: Add a GET route for manual testing (NO AUTH)
router.get('/process-translations-manual', processPendingTranslations);

/**
 * @swagger
 * /api/ai/supported-languages:
 *   get:
 *     summary: Get a list of supported languages for video translation
 *     description: Returns an array of language codes that are supported by the video translation service.
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: A list of supported languages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 languages:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["english", "spanish", "french"]
 *       500:
 *         description: Failed to fetch supported languages
 */
router.get('/supported-languages', protect, getSupportedLanguages);

/**
 * @swagger
 * /api/ai/supported-transcription-languages:
 *   get:
 *     summary: Get a list of supported languages for transcription
 *     description: Returns an object where keys are language codes (e.g., "en") and values are full language names (e.g., "English") supported by the Whisper transcription model.
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: An object of supported languages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: string
 *               example:
 *                 en: "English"
 *                 es: "Spanish"
 *                 fr: "French"
 */
router.get('/supported-transcription-languages', getSupportedTranscriptionLanguages);

module.exports = router;
