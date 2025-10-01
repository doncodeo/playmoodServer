const express = require('express');
const router = express.Router();
const {
    createHighlight,
    getHighlightsByCreator,
    getRecentHighlights,
    getAllHighlights,
} = require('../controllers/highlightController');
const { protect } = require('../middleware/authmiddleware');

/**
 * @swagger
 * /api/highlights:
 *   post:
 *     summary: Create a new highlight
 *     description: Creates a new 30-second highlight for a video. This is only available to the owner of the content.
 *     tags: [Highlights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *               - startTime
 *               - endTime
 *             properties:
 *               contentId:
 *                 type: string
 *                 description: The ID of the content to create a highlight for.
 *               startTime:
 *                 type: number
 *                 description: The start time of the highlight in seconds.
 *               endTime:
 *                 type: number
 *                 description: The end time of the highlight in seconds. The duration must be exactly 30 seconds.
 *     responses:
 *       201:
 *         description: Highlight created successfully.
 *       400:
 *         description: Invalid input, e.g., highlight is not 30 seconds, or a highlight already exists.
 *       401:
 *         description: Unauthorized, token is missing or invalid.
 *       403:
 *         description: Forbidden, user does not own the content.
 *       404:
 *         description: Content not found.
 */
router.route('/').post(protect, createHighlight);

/**
 * @swagger
 * /api/highlights/creator/{creatorId}:
 *   get:
 *     summary: Get highlights by creator
 *     description: Retrieves all highlights created by a specific user.
 *     tags: [Highlights]
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the creator.
 *     responses:
 *       200:
 *         description: A list of highlights.
 *       400:
 *         description: Invalid creator ID.
 */
router.route('/creator/:creatorId').get(getHighlightsByCreator);

/**
 * @swagger
 * /api/highlights/recent:
 *   get:
 *     summary: Get recent highlights
 *     description: Retrieves the 10 most recent highlights.
 *     tags: [Highlights]
 *     responses:
 *       200:
 *         description: A list of recent highlights.
 */
router.route('/recent').get(getRecentHighlights);

/**
 * @swagger
 * /api/highlights/all:
 *   get:
 *     summary: Get all highlights
 *     description: Retrieves all highlights.
 *     tags: [Highlights]
 *     responses:
 *       200:
 *         description: A list of all highlights.
 */
router.route('/all').get(getAllHighlights);

module.exports = router;