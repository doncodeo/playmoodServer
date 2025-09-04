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

    // Defensively check if captions is an array. If not, it's an old document.
    const captionsIsArray = Array.isArray(content.captions);

    // Check if captions for this language already exist
    if (captionsIsArray) {
        const existingCaptions = content.captions.find(c => c.languageCode === languageCode);
        if (existingCaptions) {
            return res.status(200).json({ message: `Captions for language '${languageCode}' already exist.` });
        }
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

                // If the original captions field was an array, push the new caption.
                // Otherwise, overwrite the old string field with a new array containing the new caption.
                const updateOperation = captionsIsArray
                    ? { $push: { captions: newCaption } }
                    : { $set: { captions: [newCaption] } };

                await contentSchema.updateOne({ _id: contentId }, updateOperation);

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

// @desc    Translate a video
// @route   POST /api/ai/translate-video
// @access  Private
const translateVideo = asyncHandler(async (req, res) => {
    const { contentId, language } = req.body;

    if (!contentId || !language) {
        return res.status(400).json({ error: 'Content ID and language are required' });
    }

    const content = await contentSchema.findById(contentId);
    if (!content || !content.video) {
        return res.status(404).json({ error: 'Content not found or video URL is missing' });
    }

    // Immediately respond that the process has started
    res.status(202).json({ message: `Video translation to '${language}' started. This is a long-running process.` });

    // Run the translation process in the background
    (async () => {
        try {
            await aiService.translateVideo(content.video, contentId, language);
            console.log(`[${contentId}] Video translation to '${language}' initiated successfully.`);
        } catch (error) {
            console.error(`[${contentId}] Failed to initiate video translation to '${language}':`, error.message);
        }
    })();
});

// @desc    Get a list of supported languages for translation
// @route   GET /api/ai/supported-languages
// @access  Private
const getSupportedLanguages = asyncHandler(async (req, res) => {
    try {
        const languages = await aiService.getSupportedLanguages();
        res.status(200).json({ languages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch supported languages', details: error.message });
    }
});

module.exports = {
    generateCaptions,
    generateEmbeddings,
    analyzeVideoForModeration,
    moderateComment,
    translateVideo,
    getSupportedLanguages,
};
