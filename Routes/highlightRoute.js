const express = require('express');
const router = express.Router();
const {
    getHighlightsByCreator,
    getRecentHighlights,
    getAllHighlights,
} = require('../controllers/highlightController');
const { protect } = require('../middleware/authmiddleware');

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