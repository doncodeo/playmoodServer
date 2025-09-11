const asyncHandler = require('express-async-handler');
const Highlight = require('../models/highlightModel');
const Content = require('../models/contentModel');
const mongoose = require('mongoose');

// @desc Create a new highlight
// @route POST /api/highlights
// @access Private
const createHighlight = asyncHandler(async (req, res) => {
    const { contentId, startTime, endTime } = req.body;
    const userId = req.user.id;

    if (!contentId || startTime === undefined || endTime === undefined) {
        return res.status(400).json({ error: 'Content ID, start time, and end time are required.' });
    }

    const content = await Content.findById(contentId);
    if (!content) {
        return res.status(404).json({ error: 'Content not found.' });
    }

    if (content.user.toString() !== userId) {
        return res.status(403).json({ error: 'You can only create highlights for your own content.' });
    }

    const highlight = await Highlight.create({
        user: userId,
        content: contentId,
        startTime,
        endTime,
    });

    await Content.findByIdAndUpdate(contentId, { highlight: highlight._id });

    res.status(201).json(highlight);
});

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

module.exports = {
    createHighlight,
    getHighlightsByCreator,
    getRecentHighlights,
};
