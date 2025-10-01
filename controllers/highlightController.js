const asyncHandler = require('express-async-handler');
const Highlight = require('../models/highlightModel');
const Content = require('../models/contentModel');
const mongoose = require('mongoose');

// @desc    Create a new highlight
// @route   POST /api/highlights
// @access  Private
const createHighlight = asyncHandler(async (req, res) => {
    const { contentId, startTime, endTime } = req.body;
    const userId = req.user.id;

    if (typeof startTime === 'undefined' || typeof endTime === 'undefined') {
        return res.status(400).json({ error: 'Start time and end time are required.' });
    }

    if (endTime - startTime !== 30) {
        return res.status(400).json({ error: 'Highlight must be exactly 30 seconds long.' });
    }

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return res.status(400).json({ error: 'Invalid content ID.' });
    }

    const content = await Content.findById(contentId);

    if (!content) {
        return res.status(404).json({ error: 'Content not found.' });
    }

    // Ensure the user creating the highlight is the owner of the content
    if (content.user.toString() !== userId) {
        return res.status(403).json({ error: 'User not authorized to create a highlight for this content.' });
    }

    // Check if a highlight already exists for this content
    if (content.highlight) {
        return res.status(400).json({ error: 'A highlight already exists for this content.' });
    }

    const highlight = new Highlight({
        user: userId,
        content: contentId,
        startTime,
        endTime,
    });

    const createdHighlight = await highlight.save();

    content.highlight = createdHighlight._id;
    await content.save();

    res.status(201).json(createdHighlight);
});

// @desc Get all highlights for a specific creator
// @route GET /api/highlights/creator/:creatorId
// @access Public
const getHighlightsByCreator = asyncHandler(async (req, res) => {
    const { creatorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(creatorId)) {
        return res.status(400).json({ error: 'Invalid creator ID.' });
    }

    // Find approved content for the creator
    const approvedContentIds = await Content.find({ user: creatorId, isApproved: true }).distinct('_id');

    const highlights = await Highlight.find({ user: creatorId, content: { $in: approvedContentIds } })
        .populate('content', 'title thumbnail');

    res.status(200).json(highlights);
});

// @desc Get recent highlights
// @route GET /api/highlights/recent
// @access Public
const getRecentHighlights = asyncHandler(async (req, res) => {
    // Find IDs of all approved content
    const approvedContentIds = await Content.find({ isApproved: true }).distinct('_id');

    const highlights = await Highlight.find({ content: { $in: approvedContentIds } })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('content', 'title thumbnail');

    res.status(200).json(highlights);
});

// @desc Get all highlights
// @route GET /api/highlights/all
// @access Public
const getAllHighlights = asyncHandler(async (req, res) => {
    // Find IDs of all approved content
    const approvedContentIds = await Content.find({ isApproved: true }).distinct('_id');

    const highlights = await Highlight.find({ content: { $in: approvedContentIds } })
        .sort({ createdAt: -1 })
        .populate('content', 'title thumbnail');

    res.status(200).json(highlights);
});

module.exports = {
    createHighlight,
    getHighlightsByCreator,
    getRecentHighlights,
    getAllHighlights,
};