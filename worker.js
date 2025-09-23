const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const cloudinary = require('./config/cloudinary');
const contentSchema = require('./models/contentModel');
const userSchema = require('./models/userModel');
const nodemailer = require('nodemailer');
const { compressVideo } = require('./utils/videoCompressor');
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
    const { videoFile, thumbnailFile, contentId, languageCode } = job.data;
    let compressedVideoPath = null;
    let content = null;

    try {
        console.log(`[Worker] Started processing job ${job.id} for content: ${contentId}`);
        content = await contentSchema.findById(contentId).populate('user');
        if (!content) {
            throw new Error(`Content record not found in worker for job ${job.id}.`);
        }

        // 1. Compress video
        const videoExtension = path.extname(videoFile.originalname);
        // Ensure the temp directory exists from multer upload
        const tempDir = path.dirname(videoFile.path);
        if (!fs.existsSync(tempDir)) {
            throw new Error(`Temporary directory ${tempDir} does not exist.`);
        }
        compressedVideoPath = path.join(tempDir, `compressed-${videoFile.filename}${videoExtension}`);
        await compressVideo(videoFile.path, compressedVideoPath);
        console.log(`[Worker] Video compressed for job ${job.id}`);

        // 2. Upload video to Cloudinary
        const videoResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_large(compressedVideoPath, {
                resource_type: 'video',
                folder: 'videos',
                eager: [{ width: 1280, height: 720, crop: 'fill', gravity: 'auto', format: 'jpg', start_offset: '2' }],
                chunk_size: 20000000, // 20 MB
                timeout: 300000, // 5 minutes
            }, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
        console.log(`[Worker] Video uploaded to Cloudinary for job ${job.id}`);

        // 3. Handle thumbnail
        let thumbnailUrl = '';
        let cloudinaryThumbnailId = '';
        if (thumbnailFile) {
            const thumbnailResult = await cloudinary.uploader.upload(thumbnailFile.path, {
                folder: 'thumbnails',
                transformation: [{ width: 1280, height: 720, crop: 'fill', gravity: 'auto' }],
            });
            thumbnailUrl = thumbnailResult.secure_url;
            cloudinaryThumbnailId = thumbnailResult.public_id;
        } else {
            thumbnailUrl = videoResult.eager?.[0]?.secure_url || '';
        }
        console.log(`[Worker] Thumbnail processed for job ${job.id}`);

        // 4. AI Processing
        // These can be run in parallel to speed things up
        const [captionResult, moderationResult, embeddingResult] = await Promise.allSettled([
            aiService.generateCaptions(videoResult.secure_url, contentId, languageCode),
            aiService.analyzeVideoForModeration(videoResult.secure_url),
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

        // 5. Update content document
        content.status = 'completed';
        content.video = videoResult.secure_url;
        content.cloudinary_video_id = videoResult.public_id;
        content.thumbnail = thumbnailUrl;
        content.cloudinary_thumbnail_id = cloudinaryThumbnailId;
        content.captions = initialCaptions;
        content.aiModerationStatus = moderation.status;
        content.aiModerationLabels = moderation.labels;
        content.contentEmbedding = contentEmbedding;

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

        // 6. Send email notification
        if (content.user.role !== 'admin' && moderation.status !== 'rejected') {
            const admins = await userSchema.find({ role: 'admin' });
            const previewUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_${content.shortPreview.start},eo_${content.shortPreview.end}/${videoResult.public_id}.mp4`;
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
    } finally {
        // 7. Cleanup temp files
        const filesToDelete = [videoFile?.path, thumbnailFile?.path, compressedVideoPath];
        filesToDelete.forEach(filePath => {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`[Worker] Failed to delete temp file: ${filePath}`, err);
                    else console.log(`[Worker] Deleted temp file: ${filePath}`);
                });
            }
        });
    }
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
