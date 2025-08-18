const asyncHandler = require('express-async-handler');
const aiService = require('../ai/ai-service');
const contentSchema = require('../models/contentModel');
const fs = require('fs');
const path = require('path');

// @desc    Generate captions for a video
// @route   POST /api/ai/generate-captions
// @access  Private
const generateCaptions = asyncHandler(async (req, res) => {
    const { contentId, languageCode } = req.body;

    if (!contentId) {
        return res.status(400).json({ error: 'Content ID is required' });
    }
    if (!languageCode) {
        return res.status(400).json({ error: 'Language code is required' });
    }

    const content = await contentSchema.findById(contentId);
    if (!content || !content.video) {
        return res.status(404).json({ error: 'Content not found or video URL is missing' });
    }

    // Check if captions for this language already exist
    const existingCaptions = content.captions.find(c => c.languageCode === languageCode);
    if (existingCaptions) {
        return res.status(200).json({ message: `Captions for language '${languageCode}' already exist.` });
    }

    // Immediately respond that the process has started
    res.status(202).json({ message: `Caption generation for language '${languageCode}' started. This is a long-running process.` });

    // Run the captioning process in the background
    (async () => {
        const videoUrl = content.video;

        try {
            const captionText = await aiService.generateCaptions(videoUrl, contentId, languageCode);

            if (captionText) {
                const newCaption = {
                    languageCode: languageCode,
                    text: captionText,
                };

                await contentSchema.updateOne(
                    { _id: contentId },
                    { $push: { captions: newCaption } }
                );

                console.log(`[${contentId}] Captions for language '${languageCode}' generated and saved successfully.`);
            } else {
                throw new Error('Caption generation returned no text.');
            }

        } catch (error) {
            console.error(`[${contentId}] Failed to generate captions for language '${languageCode}':`, error.message);
            // Optionally, you could add a failed status to the DB here if needed
        }
    })();
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
