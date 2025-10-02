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
        case 'combine-videos':
            return await processVideoCombination(job);
        case 'aggregate-platform-stats':
            return await aggregatePlatformStats(job);
        default:
            throw new Error(`Unknown job name: ${job.name}`);
    }
};

const processVideoCombination = async (job) => {
    // ... (existing implementation)
};

const createHighlightForContent = async (content) => {
    try {
        console.log(`[Worker] Creating highlight for content ID: ${content._id}`);
        if (!content.cloudinary_video_id) {
            throw new Error('Content does not have a Cloudinary video ID.');
        }

        // 1. Get video duration from Cloudinary
        const duration = await aiService.getVideoDuration(content.cloudinary_video_id);
        if (typeof duration !== 'number' || duration <= 0) {
            throw new Error(`Invalid duration received from AI service: ${duration}`);
        }
        content.duration = duration; // Save duration to content

        // 2. Generate highlight start and end times
        const { startTime, endTime } = aiService.generateHighlight(duration);

        // 3. Create and save the new highlight
        const newHighlight = new Highlight({
            user: content.user,
            content: content._id,
            startTime,
            endTime,
        });
        await newHighlight.save();

        // 4. Link the highlight to the content
        content.highlight = newHighlight._id;
        await content.save();

        console.log(`[Worker] Successfully created highlight ${newHighlight._id} for content ${content._id}`);
        return newHighlight;
    } catch (error) {
        console.error(`[Worker] Error creating highlight for content ${content._id}:`, error);
        // We don't re-throw the error, as highlight creation failure shouldn't fail the entire job.
        // The error is logged for monitoring.
    }
};


const processUpload = async (job) => {
    const { contentId, languageCode } = job.data;
    console.log(`[Worker] Starting 'process-upload' for content ID: ${contentId}`);

    try {
        const content = await contentSchema.findById(contentId).populate('user');
        if (!content) {
            throw new Error(`Content with ID ${contentId} not found.`);
        }

        // Generate highlight if the content is approved
        if (content.isApproved) {
            await createHighlightForContent(content);
        }

        // The rest of the original processing logic (e.g., captions, moderation) would go here.
        // For example, generating captions:
        if (languageCode) {
            const captions = await aiService.generateCaptions(content.video, contentId, languageCode);
            content.captions = captions;
        }

        // Mark as completed
        content.status = 'completed';
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

const redisConnectionOpts = {
  connection: {
    url: process.env.REDIS_URL,
    tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  },
  concurrency: 5,
};

let uploadWorker;
let analyticsWorker;
let analyticsQueue;

const startWorker = () => {
    if (uploadWorker) {
        console.log('[Worker] Workers are already running.');
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