const asyncHandler = require('express-async-handler');
const aiService = require('../ai/ai-service');
const contentSchema = require('../models/contentModel');
const { video } = require('../config/cloudinary');

// @desc    Generate captions for a video
// @route   POST /api/ai/generate-captions
// @access  Private
const generateCaptions = asyncHandler(async (req, res) => {
    const { contentId } = req.body;

    if (!contentId) {
        return res.status(400).json({ error: 'Content ID is required' });
    }

    const content = await contentSchema.findById(contentId);
    if (!content) {
        return res.status(404).json({ error: 'Content not found' });
    }

    // This assumes the video is stored locally, which might not be the case.
    // This will need to be adapted to work with cloud-stored videos.
    // For now, we'll simulate it with the video path.
    // In a real scenario, we'd need to download the video from content.video (a URL)
    // to a temporary local path before passing it to the AI service.

    // Placeholder for local video path
    const videoPath = 'path/to/local/video.mp4'; // This needs to be replaced with actual logic

    try {
        const captions = await aiService.generateCaptions(videoPath);
        content.captions = captions;
        await content.save();
        res.status(200).json({ message: 'Captions generated successfully', captions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate captions', details: error.message });
    }
});

// @desc    Generate embeddings for a piece of content
// @route   POST /api/ai/generate-embeddings
// @access  Private
const generateEmbeddings = asyncHandler(async (req, res) => {
    const { contentId } = req.body;

    if(!contentId) {
        return res.status(400).json({ error: 'Content ID is required' });
    }

    const content = await contentSchema.findById(contentId);
    if (!content) {
        return res.status(404).json({ error: 'Content not found' });
    }

    try {
        const embeddings = await aiService.generateEmbeddings(content);
        content.contentEmbedding = embeddings;
        await content.save();
        res.status(200).json({ message: 'Embeddings generated successfully', embeddings });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate embeddings', details: error.message });
    }
});

// @desc    Analyze a video for moderation
// @route   POST /api/ai/analyze-video
// @access  Private
const analyzeVideoForModeration = asyncHandler(async (req, res) => {
    const { contentId } = req.body;

    if (!contentId) {
        return res.status(400).json({ error: 'Content ID is required' });
    }

    const content = await contentSchema.findById(contentId);
    if (!content) {
        return res.status(404).json({ error: 'Content not found' });
    }

    try {
        const moderationResult = await aiService.analyzeVideoForModeration(content.video);
        content.aiModerationStatus = moderationResult.status;
        content.aiModerationLabels = moderationResult.labels;
        await content.save();
        res.status(200).json({ message: 'Video analyzed successfully', moderationResult });
    } catch (error) {
        res.status(500).json({ error: 'Failed to analyze video', details: error.message });
    }
});

// @desc    Moderate a comment
// @route   POST /api/ai/moderate-comment
// @access  Private
const moderateComment = asyncHandler(async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Comment text is required' });
    }

    try {
        const moderationResult = await aiService.moderateComment(text);
        res.status(200).json({ message: 'Comment moderated successfully', moderationResult });
    } catch (error) {
        res.status(500).json({ error: 'Failed to moderate comment', details: error.message });
    }
});

module.exports = {
    generateCaptions,
    generateEmbeddings,
    analyzeVideoForModeration,
    moderateComment,
};
