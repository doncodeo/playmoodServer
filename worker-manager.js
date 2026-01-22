const dotenv = require('dotenv');
dotenv.config();

const { Worker, Queue } = require('bullmq');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const cloudinary = require('./config/cloudinary');
const contentSchema = require('./models/contentModel');
const userSchema = require('./models/userModel');
const Highlight = require('./models/highlightModel');
const aiService = require('./ai/ai-service');
const { aggregatePlatformStats } = require('./workers/analyticsWorker');
const storageService = require('./services/storageService');
const mediaProcessor = require('./utils/mediaProcessor');

const transporter = require('./utils/mailer');

const sendEmail = (to, subject, html) => {
    const mailOptions = {
        from: `"PlaymoodTV 📺" <${process.env.EMAIL_USERNAME}>`,
        to,
        subject,
        html,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('[Worker] Error sending email:', error);
        } else {
            console.log('[Worker] Email sent:', info.response);
        }
    });
};

const mainProcessor = async (job) => {
    console.log(`[Worker] Received job ${job.id} with name ${job.name} from queue ${job.queueName}`);
    switch (job.name) {
        case 'process-upload':
            return await processUpload(job);
        case 'generate-captions':
            return await processCaptionGeneration(job);
        case 'generate-embedding':
            return await processEmbeddingGeneration(job);
        case 'combine-videos':
            return await processVideoCombination(job);
        case 'aggregate-platform-stats':
            return await aggregatePlatformStats(job);
        default:
            throw new Error(`Unknown job name: ${job.name}`);
    }
};

const processEmbeddingGeneration = async (job) => {
    const { contentId } = job.data;
    console.log(`[Worker] Starting 'generate-embedding' for content ID: ${contentId}`);

    const content = await contentSchema.findById(contentId);
    if (!content) {
        throw new Error(`Content with ID ${contentId} not found.`);
    }

    const embedding = await aiService.generateEmbeddings(content);
    if (!embedding) {
        // This will cause the job to fail, as intended.
        throw new Error(`Failed to generate embedding for content ID: ${contentId}.`);
    }

    content.contentEmbedding = embedding;
    await content.save();

    console.log(`[Worker] Successfully generated and saved embedding for content ID: ${contentId}`);
    return { success: true };
};


const processVideoCombination = async (job) => {
    // ... (existing implementation)
};

const createHighlightForContent = async (content) => {
    try {
        console.log(`[Worker] Creating highlight for content ID: ${content._id}`);

        let duration = content.duration;
        let highlightKey = null;

        if (content.storageProvider === 'cloudinary') {
            if (!content.cloudinary_video_id) {
                throw new Error('Content does not have a Cloudinary video ID.');
            }
            // 1. Get video duration from Cloudinary
            duration = await aiService.getVideoDuration(content.cloudinary_video_id);
        } else if (content.storageProvider === 'r2') {
            if (!content.videoKey) {
                throw new Error('Content does not have an R2 video key.');
            }
            // Duration should already be set during R2 processing, but let's double check
            if (!duration) {
                const tempPath = path.join(os.tmpdir(), `v-meta-${Date.now()}.mp4`);
                await storageService.downloadFromR2(content.videoKey, tempPath);
                const metadata = await mediaProcessor.getMetadata(tempPath);
                duration = metadata.format.duration;
                fs.unlinkSync(tempPath);
            }
        }

        if (typeof duration !== 'number' || duration <= 0) {
            throw new Error(`Invalid duration received: ${duration}`);
        }
        content.duration = duration;

        // 2. Generate highlight start and end times
        const { startTime, endTime } = aiService.generateHighlight(duration);

        // If R2, we also need to generate the actual highlight video file
        if (content.storageProvider === 'r2') {
            const tempVideoPath = path.join(os.tmpdir(), `v-h-${Date.now()}.mp4`);
            try {
                await storageService.downloadFromR2(content.videoKey, tempVideoPath);
                const highlightPath = await mediaProcessor.extractHighlight(tempVideoPath, startTime, endTime - startTime);
                const highlightStream = fs.createReadStream(highlightPath);
                const userId = content.user._id ? content.user._id.toString() : content.user.toString();
                const highlightName = storageService.generateFileName('highlight.mp4', `${userId}/`);
                const uploadResult = await storageService.uploadToR2(highlightStream, highlightName, 'video/mp4', storageService.namespaces.HIGHLIGHTS);

                highlightKey = uploadResult.key;
                content.highlightKey = highlightKey;

                if (fs.existsSync(highlightPath)) fs.unlinkSync(highlightPath);
            } finally {
                if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
            }
        }

        // 3. Create and save the new highlight
        const newHighlight = new Highlight({
            user: content.user,
            content: content._id,
            startTime,
            endTime,
            title: content.title,
            storageProvider: content.storageProvider,
            storageKey: highlightKey,
        });
        await newHighlight.save();

        // 4. Link the highlight to the content
        if (!content.highlights) {
            content.highlights = [];
        }
        content.highlights.push(newHighlight._id);
        await content.save();

        console.log(`[Worker] Successfully created highlight ${newHighlight._id} for content ${content._id}`);
        return newHighlight;
    } catch (error) {
        console.error(`[Worker] Error creating highlight for content ${content._id}:`, error);
        // We don't re-throw the error, as highlight creation failure shouldn't fail the entire job.
        // The error is logged for monitoring.
    }
};


const handleR2UploadProcessing = async (content, video, thumbnail) => {
    const tempVideoPath = path.join(os.tmpdir(), `v-${Date.now()}.mp4`);
    try {
        console.log(`[Worker] Processing R2 upload for content ${content._id}`);
        content.processingStatus = 'processing';
        await content.save();

        // 1. Download raw video from R2
        await storageService.downloadFromR2(video.key, tempVideoPath);

        // 2. Extract Metadata
        const metadata = await mediaProcessor.getMetadata(tempVideoPath);
        content.duration = metadata.format.duration;

        // 3. Generate Thumbnail (if not provided)
        if (!thumbnail || !thumbnail.key) {
            const thumbPath = await mediaProcessor.extractThumbnail(tempVideoPath);
            const thumbStream = fs.createReadStream(thumbPath);
            const userId = content.user._id ? content.user._id.toString() : content.user.toString();
            const thumbName = storageService.generateFileName('thumb.jpg', `${userId}/`);
            const uploadResult = await storageService.uploadToR2(thumbStream, thumbName, 'image/jpeg', storageService.namespaces.THUMBNAILS);

            content.thumbnail = uploadResult.url;
            content.thumbnailKey = uploadResult.key;
            fs.unlinkSync(thumbPath);
        }

        // 4. Generate Audio proxy for AI
        const audioPath = await mediaProcessor.extractAudio(tempVideoPath);
        const audioStream = fs.createReadStream(audioPath);
        const userId = content.user._id ? content.user._id.toString() : content.user.toString();
        const audioName = storageService.generateFileName('audio.mp3', `${userId}/`);
        const audioResult = await storageService.uploadToR2(audioStream, audioName, 'audio/mpeg', storageService.namespaces.AUDIO);
        content.audioKey = audioResult.key;
        fs.unlinkSync(audioPath);

        // 5. Move video to processed namespace
        const videoStream = fs.createReadStream(tempVideoPath);
        const userId = content.user._id ? content.user._id.toString() : content.user.toString();
        const videoName = storageService.generateFileName('video.mp4', `${userId}/`);
        const videoResult = await storageService.uploadToR2(videoStream, videoName, 'video/mp4', storageService.namespaces.VIDEOS);

        content.video = videoResult.url;
        content.videoKey = videoResult.key;

        // 6. Cleanup Raw File in R2
        await storageService.delete(video.key);

        console.log(`[Worker] R2 processing complete for content ${content._id}`);
    } catch (error) {
        console.error(`[Worker] R2 processing error for content ${content._id}:`, error);
        throw error;
    } finally {
        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    }
};

const processUpload = async (job) => {
    const { contentId, languageCode, video, thumbnail } = job.data;
    console.log(`[Worker] Starting 'process-upload' for content ID: ${contentId}`);

    try {
        const content = await contentSchema.findById(contentId).populate('user');
        if (!content) {
            throw new Error(`Content with ID ${contentId} not found.`);
        }

        if (content.storageProvider === 'r2') {
            await handleR2UploadProcessing(content, video, thumbnail);
        }

        // Generate highlight if the content is approved
        if (content.isApproved) {
            await createHighlightForContent(content);
        }

        // Generate and save content embeddings for recommendation engine
        const embedding = await aiService.generateEmbeddings(content);
        if (embedding) {
            content.contentEmbedding = embedding;
        } else {
            console.warn(`[Worker] Could not generate embedding for content ID: ${contentId}. Proceeding without it.`);
        }
        await content.save();

        // The rest of the original processing logic (e.g., captions, moderation) would go here.
        // For example, generating captions:
        if (languageCode) {
            const aiUrl = (content.storageProvider === 'r2' && content.audioKey)
                ? storageService.getUrl(content.audioKey, 'r2')
                : content.video;
            const captionText = await aiService.generateCaptions(aiUrl, contentId, languageCode);
            if (captionText) {
                const captionIndex = content.captions.findIndex(c => c.languageCode === languageCode);
                if (captionIndex > -1) {
                    content.captions[captionIndex].text = captionText;
                } else {
                    content.captions.push({ languageCode, text: captionText });
                }
            }
        }

        // Mark as completed
        content.status = 'completed';
        content.processingStatus = 'ready';
        await content.save();

        console.log(`[Worker] Finished 'process-upload' for content ID: ${contentId}`);

        // Notify user via email
        if (content.user && content.user.email) {
            const subject = 'Your Video Processing is Complete!';
            const html = `<p>Hi ${content.user.name},</p>
                        <p>Good news! Your video, "${content.title}", has been successfully processed and is now available on PlaymoodTV.</p>
                        <p>Thank you for your contribution!</p>`;
            sendEmail(content.user.email, subject, html);
        }

        return { success: true };
    } catch (error) {
        console.error(`[Worker] Error in 'process-upload' for job ${job.id}:`, error);
        // Optionally, update content status to 'failed'
        const content = await contentSchema.findById(contentId);
        if (content) {
            content.status = 'failed';
            content.processingError = error.message;
            await content.save();
        }
        throw error; // Re-throw to let BullMQ handle the job failure
    }
};

const processCaptionGeneration = async (job) => {
    const { contentId, languageCode } = job.data;
    console.log(`[Worker] Starting 'generate-captions' for content ID: ${contentId}`);

    try {
        let content = await contentSchema.findById(contentId);
        if (!content) {
            throw new Error(`Content with ID ${contentId} not found.`);
        }

        // Check for existing captions one more time to prevent race conditions
        if (Array.isArray(content.captions) && content.captions.some(c => c.languageCode === languageCode)) {
            console.log(`[Worker] Captions for language '${languageCode}' already exist for content ${contentId}. Skipping generation.`);
            return { success: true, message: 'Captions already exist.' };
        }

        const captionText = await aiService.generateCaptions(content.video, contentId, languageCode);
        if (captionText) {
            const newCaption = {
                languageCode: languageCode,
                text: captionText,
            };

            // Re-fetch the content to ensure the captions array is the latest version
            content = await contentSchema.findById(contentId);
            const captionsIsArray = Array.isArray(content.captions);
            const updateOperation = captionsIsArray
                ? { $push: { captions: newCaption } }
                : { $set: { captions: [newCaption] } };

            await contentSchema.updateOne({ _id: contentId }, updateOperation);

            console.log(`[${contentId}] Captions for language '${languageCode}' generated and saved successfully.`);
        } else {
            throw new Error('Caption generation returned no text.');
        }

        return { success: true };
    } catch (error) {
        console.error(`[Worker] Error in 'generate-captions' for job ${job.id}:`, error);
        const content = await contentSchema.findById(contentId);
        if (content) {
            content.status = 'failed';
            content.processingError = error.message;
            await content.save();
        }
        throw error;
    }
};

const redisConnectionOpts = {
  connection: {
    url: process.env.REDIS_URL,
    tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  },
  concurrency: 1,
  lockDuration: 900000, // 15 minutes
  lockRenewTime: 450000, // 7.5 minutes
};

// Force update
let uploadWorker;
let analyticsWorker;
let analyticsQueue;

const startWorker = () => {
    if (uploadWorker) {
        console.log('[Worker] Workers are already running.');
        return { uploadWorker, analyticsWorker };
    }

    // In development, use a mock worker to avoid Redis connection issues
    if (process.env.NODE_ENV === 'development') {
        console.log('[Worker] Using mock workers for development.');
        const mockWorker = {
            on: () => {}, // Mock 'on' event listener
            close: async () => {}, // Mock 'close' method
        };
        uploadWorker = mockWorker;
        analyticsWorker = mockWorker;
        return { uploadWorker, analyticsWorker };
    }

    console.log('[Worker] Initializing workers...');
    uploadWorker = new Worker('upload', mainProcessor, redisConnectionOpts);
    analyticsWorker = new Worker('analytics', mainProcessor, redisConnectionOpts);

    uploadWorker.on('completed', (job, result) => {
        console.log(`[Worker] Upload Job ${job.id} completed successfully.`);
    });

    uploadWorker.on('failed', (job, err) => {
        console.error(`[Worker] Upload Job ${job.id} failed with error:`, err.message);
    });

    analyticsWorker.on('completed', (job, result) => {
        console.log(`[Worker] Analytics Job ${job.id} completed successfully.`);
    });

    analyticsWorker.on('failed', (job, err) => {
        console.error(`[Worker] Analytics Job ${job.id} failed with error:`, err.message);
    });

    // Schedule the analytics job
    analyticsQueue = new Queue('analytics', { connection: redisConnectionOpts.connection });

    // Remove any existing repeatable jobs to avoid duplicates
    analyticsQueue.getRepeatableJobs().then(jobs => {
        jobs.forEach(job => {
            if (job.name === 'aggregate-platform-stats') {
                analyticsQueue.removeRepeatableByKey(job.key);
            }
        });
    }).then(() => {
        // Schedule to run daily at midnight UTC
        analyticsQueue.add('aggregate-platform-stats', {}, {
            repeat: {
                pattern: '0 0 * * *' // cron pattern for midnight
            },
            jobId: 'daily-platform-stats-aggregation'
        });
    });

    console.log('[Worker] Workers started and are listening for jobs...');
    console.log('[Worker] Analytics job scheduled to run daily.');

    return { uploadWorker, analyticsWorker };
};

const gracefulShutdown = async () => {
    console.log('[Worker] Shutting down gracefully.');
    if (uploadWorker) await uploadWorker.close();
    if (analyticsWorker) await analyticsWorker.close();
    if (analyticsQueue) await analyticsQueue.close();
    await mongoose.disconnect();
    process.exit(0);
};

module.exports = { startWorker, gracefulShutdown, createHighlightForContent };