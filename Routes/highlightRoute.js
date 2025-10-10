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
 *     description: Creates a new highlight for a video. This is available to the content creator or an admin. Timelines of highlights for the same content cannot overlap.
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
 *                 description: The end time of the highlight in seconds.
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