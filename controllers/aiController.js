const asyncHandler = require('express-async-handler');
const aiService = require('../ai/ai-service');
const contentSchema = require('../models/contentModel');
const { downloadFile } = require('../utils/fileHelpers');
const cloudinary = require('../config/cloudinary');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fsp = require('fs').promises;

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

    // Check if a translation for this language is already pending or successful
    const existingTranslation = content.translatedVideos.find(v => v.language === language && (v.status === 'pending' || v.status === 'success'));
    if (existingTranslation) {
        return res.status(409).json({ message: `A translation for language '${language}' already exists or is in progress.` });
    }

    try {
        const videoTranslateId = await aiService.translateVideo(content.video, contentId, language);

        const newTranslation = {
            language: language,
            videoTranslateId: videoTranslateId,
            status: 'pending'
        };

        content.translatedVideos.push(newTranslation);
        await content.save();

        res.status(201).json({ message: `Video translation to '${language}' initiated successfully.`, videoTranslateId: videoTranslateId });

    } catch (error) {
        console.error(`[${contentId}] Failed to initiate video translation to '${language}':`, error.message);
        res.status(500).json({ error: 'Failed to initiate video translation', details: error.message });
    }
});

// @desc    Process pending video translations
// @route   POST /api/ai/process-translations
// @access  Private (or protected by a secret key if called by a cron job)
const processPendingTranslations = asyncHandler(async (req, res) => {
    console.log('Starting to process pending and running video translations...');

    const contentsToProcess = await contentSchema.find({
        'translatedVideos.status': { $in: ['pending', 'running'] }
    });

    if (contentsToProcess.length === 0) {
        console.log('No pending or running translations found.');
        return res.status(200).json({ message: 'No pending or running translations to process.' });
    }

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let runningCount = 0;

    for (const content of contentsToProcess) {
        let needsSave = false;
        for (const translation of content.translatedVideos) {
            if (translation.status === 'pending' || translation.status === 'running') {
                processedCount++;
                try {
                    if (!translation.videoTranslateId) {
                        throw new Error('Missing videoTranslateId. Cannot check status.');
                    }

                    const statusData = await aiService.checkTranslationStatus(translation.videoTranslateId);

                    let etaInfo = statusData.eta ? ` ETA: ${statusData.eta}s.` : '';
                    console.log(`[${content._id}] Status for ${translation.language} (${translation.videoTranslateId}): ${statusData.status}.${etaInfo}`);

                    translation.status = statusData.status;
                    translation.eta = statusData.eta; // This will be undefined if not present, which is fine
                    needsSave = true;

                    if (statusData.status === 'success') {
                        const tempFileName = `${crypto.randomBytes(16).toString('hex')}.mp4`;
                        const tempFilePath = path.join(os.tmpdir(), tempFileName);
                        console.log(`[${content._id}] Downloading translated video from ${statusData.url} to ${tempFilePath}`);
                        await downloadFile(statusData.url, tempFilePath);

                        console.log(`[${content._id}] Uploading ${tempFilePath} to Cloudinary...`);
                        const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
                            resource_type: 'video',
                            folder: `translated_videos/${content._id}`
                        });
                        console.log(`[${content._id}] Successfully uploaded to Cloudinary. Public ID: ${uploadResult.public_id}`);

                        await fsp.unlink(tempFilePath);

                        translation.url = uploadResult.secure_url;
                        translation.cloudinary_video_id = uploadResult.public_id;
                        translation.eta = undefined; // Clear ETA on completion
                        successCount++;

                    } else if (statusData.status === 'failed') {
                        console.error(`[${content._id}] Translation failed for ${translation.language}. Reason: ${statusData.message}`);
                        translation.eta = undefined; // Clear ETA on failure
                        failedCount++;
                    } else if (statusData.status === 'running') {
                        runningCount++;
                    }

                } catch (error) {
                    // This will catch the missing ID error, or any other errors from the try block
                    console.error(`[${content._id}] CRITICAL ERROR processing translation for language ${translation.language}:`, error.message);
                    translation.status = 'failed';
                    translation.eta = undefined;
                    failedCount++;
                    needsSave = true;
                }
            }
        }
        if (needsSave) {
            await content.save();
        }
    }

    const summary = `Processing complete. Processed: ${processedCount}, Succeeded: ${successCount}, Failed: ${failedCount}, Still Running: ${runningCount}.`;
    console.log(summary);
    res.status(200).json({ message: summary, processed: processedCount, success: successCount, failed: failedCount, running: runningCount });
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
    processPendingTranslations,
    getSupportedLanguages,
};
