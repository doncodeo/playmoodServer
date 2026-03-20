const asyncHandler = require('express-async-handler');
const Highlight = require('../models/highlightModel');
const Content = require('../models/contentModel');
const mongoose = require('mongoose');
const storageService = require('../services/storageService');
const uploadQueue = require('../config/queue');

// @desc    Create a new highlight
// @route   POST /api/highlights
// @access  Private (Creator or Admin)
const createHighlight = asyncHandler(async (req, res) => {
    const { contentId, startTime, endTime, title, videoKey, thumbnailKey } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // 1. Standalone Upload Flow
    if (videoKey) {
        if (!title) {
            return res.status(400).json({ error: 'Title is required for standalone highlights.' });
        }

        // Validate R2 video key
        const videoExists = await storageService.checkFileExists(videoKey);
        if (!videoExists) {
            return res.status(400).json({ error: `The specified video key '${videoKey}' does not exist in R2.` });
        }

        // Validate R2 thumbnail key if provided
        if (thumbnailKey) {
            const thumbExists = await storageService.checkFileExists(thumbnailKey);
            if (!thumbExists) {
                return res.status(400).json({ error: `The specified thumbnail key '${thumbnailKey}' does not exist in R2.` });
            }
        }

        const highlight = new Highlight({
            user: userId,
            title,
            videoKey,
            thumbnailKey,
            storageProvider: 'r2',
            status: 'processing',
            isApproved: true, // Auto-approve all highlights per feedback
        });

        const createdHighlight = await highlight.save();

        // Queue background processing
        await uploadQueue.add('process-highlight', {
            highlightId: createdHighlight._id,
            videoKey,
            thumbnailKey,
        }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
        });

        return res.status(201).json({
            message: 'Highlight upload received and is being processed.',
            highlightId: createdHighlight._id,
            status: 'processing'
        });
    }

    // 2. Timeframe-based Flow (Existing)
    if (typeof startTime === 'undefined' || typeof endTime === 'undefined' || startTime >= endTime) {
        return res.status(400).json({ error: 'Valid start and end times are required for timeframe highlights.' });
    }

    if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
        return res.status(400).json({ error: 'Invalid or missing content ID.' });
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

    let highlightUrl = null;
    if (content.storageProvider === 'cloudinary' && content.cloudinary_video_id) {
        highlightUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/e_accelerate:50,so_${startTime},eo_${endTime}/${content.cloudinary_video_id}.mp4`;
    }

    const highlight = new Highlight({
        user: userId,
        content: contentId,
        startTime,
        endTime,
        title: title || content.title,
        storageProvider: content.storageProvider,
        highlightUrl: highlightUrl,
        status: content.storageProvider === 'r2' ? 'processing' : 'completed',
        isApproved: true, // Auto-approve all highlights per feedback
    });

    const createdHighlight = await highlight.save();

    content.highlights.push(createdHighlight._id);
    if (highlightUrl) {
        content.highlightUrl = highlightUrl;
    }
    await content.save();

    // For R2, timeframe highlights also need background processing to cut the video
    if (content.storageProvider === 'r2') {
        await uploadQueue.add('process-highlight', {
            highlightId: createdHighlight._id,
            contentId: content._id,
            startTime,
            endTime,
        }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
        });

        return res.status(201).json({
            message: 'Highlight timeframe received and is being processed.',
            highlightId: createdHighlight._id,
            status: 'processing'
        });
    }

    res.status(201).json(createdHighlight);
});

/**
 * Helper to ensure standalone highlights have a consistent structure for the frontend,
 * especially regarding the "content" field and thumbnails.
 */
const formatHighlightResponse = (highlight) => {
    const h = highlight.toObject();

    // If standalone (no linked content), create a mock content object
    // to prevent frontend "Cannot read property of undefined" errors.
    if (!h.content) {
        h.content = {
            _id: h._id,
            title: h.title,
            thumbnail: h.thumbnail,
            user: h.user,
            createdAt: h.createdAt,
            // Standalone highlights act as their own content
            video: h.highlightUrl,
            description: 'Standalone Highlight',
            views: 0,
            likesCount: 0,
            commentsCount: 0
        };
    }
    return h;
};

// @desc Get all highlights for a specific creator
// @route GET /api/highlights/creator/:creatorId
// @access Public
const getHighlightsByCreator = asyncHandler(async (req, res) => {
    const { creatorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(creatorId)) {
        return res.status(400).json({ error: 'Invalid creator ID.' });
    }

    // Find highlights for the creator that are either standalone and approved OR linked to approved content
    const creatorApprovedContentIds = await Content.find({ user: creatorId, isApproved: true }).distinct('_id');

    const highlights = await Highlight.find({
        user: creatorId,
        $or: [
            { content: { $in: creatorApprovedContentIds } },
            { content: { $exists: false }, isApproved: true }
        ]
    })
        .populate({
            path: 'content',
            select: 'title thumbnail views description category createdAt likesCount commentsCount comments likes',
            populate: {
                path: 'comments.user',
                select: 'name profileImage'
            }
        })
        .populate('user', 'name profileImage');

    res.status(200).json(highlights.map(formatHighlightResponse));
});

// @desc Get recent highlights
// @route GET /api/highlights/recent
// @access Public
const getRecentHighlights = asyncHandler(async (req, res) => {
    const approvedContentIds = await Content.find({ isApproved: true }).sort({ createdAt: -1 }).limit(1000).distinct('_id');

    const highlights = await Highlight.find({
        $or: [
            { content: { $in: approvedContentIds } },
            { content: { $exists: false }, isApproved: true }
        ]
    })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate({
            path: 'content',
            select: 'title thumbnail views description category createdAt likesCount commentsCount comments likes',
            populate: {
                path: 'comments.user',
                select: 'name profileImage'
            }
        })
        .populate('user', 'name profileImage');

    res.status(200).json(highlights.map(formatHighlightResponse));
});

// @desc Get all highlights
// @route GET /api/highlights/all
// @access Public
const getAllHighlights = asyncHandler(async (req, res) => {
    const approvedContentIds = await Content.find({ isApproved: true }).sort({ createdAt: -1 }).limit(2000).distinct('_id');

    const highlights = await Highlight.find({
        $or: [
            { content: { $in: approvedContentIds } },
            { content: { $exists: false }, isApproved: true }
        ]
    })
        .sort({ createdAt: -1 })
        .populate({
            path: 'content',
            select: 'title thumbnail views description category createdAt likesCount commentsCount comments likes',
            populate: {
                path: 'comments.user',
                select: 'name profileImage'
            }
        })
        .populate('user', 'name profileImage');

    res.status(200).json(highlights.map(formatHighlightResponse));
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

    // If it was linked to content, remove the reference
    if (highlight.content) {
        await Content.updateOne(
            { _id: highlight.content },
            { $pull: { highlights: highlightId } }
        );
    }

    // Delete R2 assets if they exist
    if (highlight.storageProvider === 'r2') {
        if (highlight.storageKey) await storageService.delete(highlight.storageKey, 'r2');
        if (highlight.thumbnailKey) await storageService.delete(highlight.thumbnailKey, 'r2');
    }

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
