const express = require('express');
const router = express.Router();
const {
    createHighlight,
    getHighlightsByCreator,
    getRecentHighlights,
    getAllHighlights,
    deleteHighlight,
} = require('../controllers/highlightController');
const { protect } = require('../middleware/authmiddleware');

/**
 * @swagger
 * /api/highlights/{id}:
 *   delete:
 *     summary: Delete a highlight
 *     description: Deletes a highlight by its ID. This is only available to the creator of the highlight or an admin.
 *     tags: [Highlights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the highlight to delete.
 *     responses:
 *       200:
 *         description: Highlight deleted successfully.
 *       400:
 *         description: Invalid highlight ID.
 *       401:
 *         description: Unauthorized, token is missing or invalid.
 *       403:
 *         description: Forbidden, user is not the creator or an admin.
 *       404:
 *         description: Highlight not found.
 */
router.route('/:id').delete(protect, deleteHighlight);

/**
 * @swagger
 * /api/highlights:
 *   post:
 *     summary: Create a new highlight
 *     description: |
 *       Creates a new highlight. Supports two methods:
 *       1. **Timeframe-based:** Select a segment from existing content.
 *       2. **Standalone Upload:** Upload a new video file specifically as a highlight.
 *
 *       Standalone highlights are not linked to existing content and can be uploaded directly to R2.
 *     tags: [Highlights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: The title of the highlight (Required for standalone).
 *                 example: "Incredible Goal!"
 *               contentId:
 *                 type: string
 *                 description: (Timeframe only) The ID of the content to create a highlight from.
 *                 example: "60d0fe4f5311236168a109ca"
 *               startTime:
 *                 type: number
 *                 description: (Timeframe only) Start time in seconds.
 *                 example: 10
 *               endTime:
 *                 type: number
 *                 description: (Timeframe only) End time in seconds.
 *                 example: 20
 *               videoKey:
 *                 type: string
 *                 description: (Standalone only) The R2 key of the uploaded video file.
 *                 example: "raw/user123/123456789-abc.mp4"
 *               thumbnailKey:
 *                 type: string
 *                 description: (Standalone only) Optional R2 key for a custom thumbnail.
 *                 example: "raw/user123/123456789-thumb.jpg"
 *     responses:
 *       201:
 *         description: Highlight created successfully.
 *       400:
 *         description: Invalid input, e.g., overlapping timeline with an existing highlight.
 *       401:
 *         description: Unauthorized, token is missing or invalid.
 *       403:
 *         description: Forbidden, user is not the creator or an admin.
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
 *         description: A list of highlights with populated content details.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Highlight'
 *       400:
 *         description: Invalid creator ID.
 */
router.route('/creator/:creatorId').get(getHighlightsByCreator);

/**
 * @swagger
 * /api/highlights/recent:
 *   get:
 *     summary: Get recent highlights
 *     description: Retrieves the 10 most recent highlights with populated content details.
 *     tags: [Highlights]
 *     responses:
 *       200:
 *         description: A list of recent highlights.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Highlight'
 */
router.route('/recent').get(getRecentHighlights);

/**
 * @swagger
 * /api/highlights/all:
 *   get:
 *     summary: Get all highlights
 *     description: Retrieves all highlights with populated content details.
 *     tags: [Highlights]
 *     responses:
 *       200:
 *         description: A list of all highlights.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Highlight'
 */
router.route('/all').get(getAllHighlights);

module.exports = router;