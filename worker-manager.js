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

const processUpload = async (job) => {
    // ... (existing implementation)
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

module.exports = { startWorker, gracefulShutdown };