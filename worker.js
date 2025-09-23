const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const contentSchema = require('./models/contentModel');
const userSchema = require('./models/userModel');
const nodemailer = require('nodemailer');
const aiService = require('./ai/ai-service');

// Load environment variables from the root .env file
dotenv.config();

// --- Database Connection ---
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {});
        console.log(`[Worker] MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[Worker] Error connecting to MongoDB: ${error.message}`);
        // We don't exit the process here, as the worker might retry connecting.
        // BullMQ can handle Redis connection issues, but we need to manage DB connection.
        throw error; // Throw error to be caught by the worker's fail handler
    }
};

// --- Email Transport ---
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
    }
});

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

// --- Job Processor Logic ---
const processUpload = async (job) => {
    const { contentId, languageCode, video, thumbnail } = job.data;
    let content = null;

    try {
        console.log(`[Worker] Started processing job ${job.id} for content: ${contentId}`);
        content = await contentSchema.findById(contentId).populate('user');
        if (!content) {
            throw new Error(`Content record not found in worker for job ${job.id}.`);
        }

        // The video and optional thumbnail are already uploaded to Cloudinary.
        // The primary video URL is in `video.url`.
        // The primary video public_id is in `video.public_id`.
        // An optional thumbnail URL is in `thumbnail.url`.
        // An optional thumbnail public_id is in `thumbnail.public_id`.

        // A. Generate a thumbnail from the video if one wasn't uploaded.
        let thumbnailUrl = thumbnail ? thumbnail.url : '';
        let thumbnailPublicId = thumbnail ? thumbnail.public_id : '';

        if (!thumbnailUrl) {
            // This generates a URL for a thumbnail from the 2nd second of the video.
            // It doesn't create a new asset, just a dynamically transformed URL.
            thumbnailUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_2/${video.public_id}.jpg`;
        }

        // B. AI Processing (can run in parallel)
        console.log(`[Worker] Starting AI processing for job ${job.id}`);
        const [captionResult, moderationResult, embeddingResult] = await Promise.allSettled([
            aiService.generateCaptions(video.url, contentId, languageCode),
            aiService.analyzeVideoForModeration(video.url),
            aiService.generateEmbeddings({ title: content.title, description: content.description, category: content.category })
        ]);

        let initialCaptions = [];
        if (captionResult.status === 'fulfilled' && captionResult.value) {
            initialCaptions.push({ languageCode: languageCode || 'en_us', text: captionResult.value });
        } else if (captionResult.status === 'rejected') {
            console.error(`[Worker] Failed to generate captions for ${contentId}:`, captionResult.reason);
        }

        let moderation = { status: 'needs_review', labels: [] };
        if (moderationResult.status === 'fulfilled') {
            moderation = moderationResult.value;
        } else {
            console.error(`[Worker] Failed to analyze video for moderation for ${contentId}:`, moderationResult.reason);
        }

        let contentEmbedding = [];
        if (embeddingResult.status === 'fulfilled') {
            contentEmbedding = embeddingResult.value;
        } else {
            console.error(`[Worker] Failed to generate content embeddings for ${contentId}:`, embeddingResult.reason);
        }
        console.log(`[Worker] AI processing complete for job ${job.id}`);

        // C. Update content document in the database
        content.status = 'completed';
        content.video = video.url;
        content.cloudinary_video_id = video.public_id;
        content.thumbnail = thumbnailUrl;
        content.cloudinary_thumbnail_id = thumbnailPublicId; // May be empty if thumbnail is derived
        content.captions = initialCaptions;
        content.aiModerationStatus = moderation.status;
        content.aiModerationLabels = moderation.labels;
        content.contentEmbedding = contentEmbedding;

        // Determine approval status based on moderation
        let isApproved = content.user.role === 'admin';
        if (moderation.status === 'approved' && !isApproved) {
            isApproved = true;
        } else if (moderation.status === 'rejected') {
            isApproved = false;
            content.rejectionReason = `Content automatically rejected by AI due to: ${moderation.labels.join(', ')}`;
        }
        content.isApproved = isApproved;

        await content.save();
        console.log(`[Worker] Content document updated for job ${job.id}`);

        // D. Send email notification for content needing review
        if (content.user.role !== 'admin' && moderation.status !== 'rejected') {
            const admins = await userSchema.find({ role: 'admin' });
            const previewUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_${content.shortPreview.start},eo_${content.shortPreview.end}/${video.public_id}.mp4`;
            admins.forEach(admin => {
                sendEmail(admin.email, 'New Content Approval Request', `<p>A new content titled "${content.title}" has been uploaded and requires your approval.</p><p><a href="${process.env.APP_URL}/admin/approve-content/${content._id}">Approve Content</a></p><p>Preview: <a href="${previewUrl}">View Preview</a></p>`);
            });
        }

        return { contentId: contentId, status: 'success' };

    } catch (error) {
        console.error(`[Worker] Job ${job.id} for content ${contentId} failed:`, error);
        if (content) {
            // If the job fails, delete the content record to avoid orphaned data
            await contentSchema.findByIdAndDelete(contentId);
            console.log(`[Worker] Deleted content document for failed job ${job.id}`);
        }
        // Re-throw the error to let BullMQ know the job has failed
        throw error;
    }
    // No 'finally' block is needed for file cleanup anymore
};

// --- Worker Initialization ---
const redisConnectionOpts = {
  connection: {
    url: process.env.REDIS_URL,
    tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  },
  concurrency: 5, // Process up to 5 jobs concurrently
};

let worker;

const startWorker = async () => {
    await connectDB();

    worker = new Worker('upload', processUpload, redisConnectionOpts);

    worker.on('completed', (job, result) => {
        console.log(`[Worker] Job ${job.id} completed successfully. Result:`, result);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job.id} failed with error:`, err.message);
    });

    console.log('[Worker] Worker started and is listening for jobs...');
};

startWorker().catch(err => {
    console.error("[Worker] Failed to start worker:", err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[Worker] SIGTERM received. Shutting down gracefully.');
    if (worker) {
        await worker.close();
    }
    await mongoose.disconnect();
    process.exit(0);
});
