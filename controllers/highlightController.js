const asyncHandler = require('express-async-handler');
const Highlight = require('../models/highlightModel');
const Content = require('../models/contentModel');
const mongoose = require('mongoose');

// @desc    Create a new highlight
// @route   POST /api/highlights
// @access  Private (Creator or Admin)
const createHighlight = asyncHandler(async (req, res) => {
    const { contentId, startTime, endTime } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (typeof startTime === 'undefined' || typeof endTime === 'undefined' || startTime >= endTime) {
        return res.status(400).json({ error: 'Valid start and end times are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return res.status(400).json({ error: 'Invalid content ID.' });
    }

    const content = await Content.findById(contentId).populate('highlights');

    if (!content) {
        return res.status(404).json({ error: 'Content not found.' });
    }

    // Ensure the user is the content creator or an admin
    if (content.user.toString() !== userId && userRole !== 'admin') {
        return res.status(403).json({ error: 'User not authorized to create a highlight for this content.' });
    }

    // Check for overlapping highlights
    const isOverlapping = content.highlights.some(highlight =>
        (startTime < highlight.endTime && endTime > highlight.startTime)
    );

    if (isOverlapping) {
        return res.status(400).json({ error: 'Highlight timeline overlaps with an existing highlight.' });
    }

    const highlight = new Highlight({
        user: userId,
        content: contentId,
        startTime,
        endTime,
    });

    const createdHighlight = await highlight.save();

    content.highlights.push(createdHighlight._id);
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

// @desc    Delete a highlight
// @route   DELETE /api/highlights/:id
// @access  Private (Creator or Admin)
const deleteHighlight = asyncHandler(async (req, res) => {
    const highlightId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(highlightId)) {
        return res.status(400).json({ message: 'Invalid highlight ID' });
    }

    const highlight = await Highlight.findById(highlightId);

    if (!highlight) {
        return res.status(404).json({ message: 'Highlight not found' });
    }

    // Check if the user is the creator of the highlight or an admin
    if (highlight.user.toString() !== userId && userRole !== 'admin') {
        return res.status(403).json({ message: 'User not authorized to delete this highlight' });
    }

    // Find the content associated with the highlight and remove the reference
    await Content.updateOne(
        { highlights: highlightId },
        { $pull: { highlights: highlightId } }
    );

    await Highlight.findByIdAndDelete(highlightId);

    res.status(200).json({ message: 'Highlight deleted successfully' });
});

module.exports = {
    createHighlight,
    getHighlightsByCreator,
    getRecentHighlights,
    getAllHighlights,
    deleteHighlight,
};