const asyncHandler = require('express-async-handler');
const Highlight = require('../models/highlightModel');
const Content = require('../models/contentModel');
const mongoose = require('mongoose');

// @desc Get all highlights for a specific creator
// @route GET /api/highlights/creator/:creatorId
// @access Public
const getHighlightsByCreator = asyncHandler(async (req, res) => {
    const { creatorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(creatorId)) {
        return res.status(400).json({ error: 'Invalid creator ID.' });
    }

    const highlights = await Highlight.find({ user: creatorId }).populate('content', 'title thumbnail');
    res.status(200).json(highlights);
});

// @desc Get recent highlights
// @route GET /api/highlights/recent
// @access Public
const getRecentHighlights = asyncHandler(async (req, res) => {
    const highlights = await Highlight.find().sort({ createdAt: -1 }).limit(10).populate('content', 'title thumbnail');
    res.status(200).json(highlights);
});

// @desc Get all highlights
// @route GET /api/highlights/all
// @access Public
const getAllHighlights = asyncHandler(async (req, res) => {
    const highlights = await Highlight.find().sort({ createdAt: -1 }).populate('content', 'title thumbnail');
    res.status(200).json(highlights);
});

module.exports = {
    getHighlightsByCreator,
    getRecentHighlights,
    getAllHighlights,
};