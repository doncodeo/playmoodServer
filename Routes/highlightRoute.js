const express = require('express');
const router = express.Router();
const {
    createHighlight,
    getHighlightsByCreator,
    getRecentHighlights,
} = require('../controllers/highlightController');
const { protect } = require('../middleware/authmiddleware');

router.route('/').post(protect, createHighlight);
router.route('/creator/:creatorId').get(getHighlightsByCreator);
router.route('/recent').get(getRecentHighlights);

module.exports = router;
