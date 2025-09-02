const express = require('express');
const router = express.Router();
const {
    createHighlight,
    getHighlightsByCreator,
    getRecentHighlights,
} = require('../controllers/highlightController');
const { protect } = require('../middleware/authmiddleware');

/**
 * @swagger
 * /api/highlights:
 *   post:
 *     summary: Create a new highlight
 *     description: Creates a new highlight for a video, specifying the start and end times.
 *     tags: [Highlights]
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
 *                 description: The end time of the highlight in seconds.
 *     responses:
 *       201:
 *         description: Highlight created successfully.
 *       400:
 *         description: Bad request, missing required fields.
 *       401:
 *         description: Unauthorized, token is missing or invalid.
 *       403:
 *         description: Forbidden, user is not the owner of the content.
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

module.exports = router;
