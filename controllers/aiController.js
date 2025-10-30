const asyncHandler = require('express-async-handler');
const { Queue } = require('bullmq');
const aiService = require('../ai/ai-service');
const contentSchema = require('../models/contentModel');
const { downloadFile } = require('../utils/fileHelpers');
const { compressVideo } = require('../utils/videoCompressor');
const cloudinary = require('../config/cloudinary');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fsp = require('fs').promises;

const redisConnectionOpts = {
  connection: {
    url: process.env.REDIS_URL,
    tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  },
};

const uploadQueue = new Queue('upload', redisConnectionOpts);

let isProcessing = false;

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

    // Check the number of active and waiting jobs
    const jobCounts = await uploadQueue.getJobCounts('wait', 'active');
    const totalJobs = jobCounts.wait + jobCounts.active;

    if (totalJobs > 10) {
        return res.status(503).json({
            error: 'The captioning service is currently busy. Please try again in a few minutes.'
        });
    }

    // Add a job to the queue
    await uploadQueue.add('generate-captions', { contentId, languageCode }, {
        attempts: 1,
        removeOnFail: true,
    });

    // Immediately respond that the process has started
    res.status(202).json({ message: `Caption generation for language '${languageCode}' has been queued.` });
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

    // Check for an existing translation for this language
    const existingTranslationIndex = content.translatedVideos.findIndex(v => v.language === language);

    if (existingTranslationIndex !== -1) {
        const existingTranslation = content.translatedVideos[existingTranslationIndex];
        // If it's pending or successful, prevent a new one
        if (existingTranslation.status === 'pending' || existingTranslation.status === 'success' || existingTranslation.status === 'running') {
            return res.status(409).json({ message: `A translation for language '${language}' already exists or is in progress.` });
        }
        // If it failed, remove it so it can be retried
        if (existingTranslation.status === 'failed') {
            content.translatedVideos.splice(existingTranslationIndex, 1);
        }
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
    if (isProcessing) {
        console.log("Translation processing is already running. Skipping this run.");
        return res.status(409).json({ message: "Translation processing is already in progress." });
    }

    isProcessing = true;
    // Immediately respond that the process has started
    res.status(202).json({ message: "Translation processing initiated." });

    (async () => {
        try {
            console.log('Starting to process pending and running video translations...');

            const contentsToProcess = await contentSchema.find({
                'translatedVideos': {
                    '$elemMatch': {
                        'status': { '$in': ['pending', 'running'] },
                        'url': { '$exists': false }
                    }
                }
            });

            if (contentsToProcess.length === 0) {
                console.log('No pending or running translations found.');
                return;
            }

            let processedCount = 0;
            let successCount = 0;
            let failedCount = 0;
            let runningCount = 0;

            for (const content of contentsToProcess) {
                for (const translation of content.translatedVideos) {
                    if (translation.status === 'pending' || translation.status === 'running') {
                        let needsSave = false;
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

                                const compressedTempFilePath = path.join(os.tmpdir(), `compressed_${tempFileName}`);
                                let fileToUploadPath = tempFilePath;
                                try {
                                    console.log(`[${content._id}] Downloading translated video from ${statusData.url} to ${tempFilePath}`);
                                    await downloadFile(statusData.url, tempFilePath);

                                     // Compress the video
                                    console.log(`[${content._id}] Compressing video: ${tempFilePath}`);
                                    await compressVideo(tempFilePath, compressedTempFilePath);
                                    console.log(`[${content._id}] Video compressed successfully: ${compressedTempFilePath}`);
                                    fileToUploadPath = compressedTempFilePath;

                                    console.log(`[${content._id}] Uploading ${fileToUploadPath} to Cloudinary...`);
                                    await new Promise((resolve, reject) => {
                                        cloudinary.uploader.upload_large(fileToUploadPath, {
                                            resource_type: 'video',
                                            folder: `translated_videos/${content._id}`,
                                            chunk_size: 20000000 // 20MB
                                        }, (error, result) => {
                                            if (error || !result || !result.public_id) {
                                                // Reject the promise if there's an error from Cloudinary or if the result is invalid.
                                                return reject(error || new Error('Cloudinary upload failed: Invalid result'));
                                            }

                                            // On success, update the translation object and increment counters
                                            console.log(`[${content._id}] Successfully uploaded to Cloudinary. Public ID: ${result.public_id}`);
                                            translation.url = result.secure_url;
                                            translation.cloudinary_video_id = result.public_id;
                                            translation.eta = undefined; // Clear ETA on completion
                                            successCount++;
                                            resolve(result); // Resolve the promise to signal completion
                                        });
                                    });
                                } catch (processingError) {
                                    console.error(`[${content._id}] FAILED to process successful translation for language ${translation.language}. Error:`, processingError);
                                    // If download/upload fails, we need to mark this specific translation as failed.
                                    // This overwrites the 'success' status we got from Heygen.
                                    translation.status = 'failed';
                                    failedCount++; // This is important for the final summary log.
                                } finally {
                                    // Ensure both temp files are deleted even if the upload fails
                                    for (const p of [tempFilePath, compressedTempFilePath]) {
                                        if (p) { // Check if path is defined
                                            await fsp.unlink(p).catch(err => {
                                                // Ignore ENOENT (file not found) errors, but log others
                                                if (err.code !== 'ENOENT') {
                                                    console.error(`Failed to delete temp file ${p}:`, err);
                                                }
                                            });
                                        }
                                    }
                                }

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

                        if (needsSave) {
                            const updateQuery = { _id: content._id, "translatedVideos.videoTranslateId": translation.videoTranslateId };
                            const updateOperation = {
                                "$set": {
                                    "translatedVideos.$.status": translation.status,
                                    "translatedVideos.$.url": translation.url,
                                    "translatedVideos.$.cloudinary_video_id": translation.cloudinary_video_id,
                                },
                                "$unset": {
                                    "translatedVideos.$.eta": ""
                                }
                            };
                            await contentSchema.updateOne(updateQuery, updateOperation);
                        }
                    }
                }
            }

            const summary = `Processing complete. Processed: ${processedCount}, Succeeded: ${successCount}, Failed: ${failedCount}, Still Running: ${runningCount}.`;
            console.log(summary);
        } catch (error) {
            console.error("An unexpected error occurred in the translation processing job:", error);
        } finally {
            isProcessing = false;
            console.log("Translation processing finished. Releasing lock.");
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

// @desc    Get a list of supported languages for transcription
// @route   GET /api/ai/supported-transcription-languages
// @access  Public
const getSupportedTranscriptionLanguages = asyncHandler(async (req, res) => {
    const languages = {
        "en": "English",
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese",
        "ru": "Russian",
        "zh": "Chinese",
        "ja": "Japanese",
        "ko": "Korean",
        "ar": "Arabic",
    };
    res.status(200).json(languages);
});

module.exports = {
    generateCaptions,
    generateEmbeddings,
    analyzeVideoForModeration,
    moderateComment,
    translateVideo,
    processPendingTranslations,
    getSupportedLanguages,
    getSupportedTranscriptionLanguages,
};
