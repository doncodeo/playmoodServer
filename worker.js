const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const cloudinary = require('./config/cloudinary');
const contentSchema = require('./models/contentModel');
const userSchema = require('./models/userModel');
const Highlight = require('./models/highlightModel');
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

// --- Job Processor Logic ---

const mainProcessor = async (job) => {
    console.log(`[Worker] Received job ${job.id} with name ${job.name}`);
    switch (job.name) {
        case 'process-upload':
            return await processUpload(job);
        case 'combine-videos':
            return await processVideoCombination(job);
        default:
            throw new Error(`Unknown job name: ${job.name}`);
    }
};

const processVideoCombination = async (job) => {
    const { contentIds, title, description, category, credit, userId } = job.data;
    const tempDir = path.join(__dirname, 'temp', job.id);
    const fileListPath = path.join(tempDir, 'filelist.txt');
    const outputPath = path.join(tempDir, 'output.mp4');
    let downloadedFiles = [];

    try {
        // 1. Create a temporary directory for this job
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // 2. Fetch content documents and download video files
        const contents = await contentSchema.find({ '_id': { $in: contentIds } });
        if (contents.length !== contentIds.length) {
            throw new Error("Could not find all content documents for the given IDs.");
        }

        let fileListContent = '';
        for (const content of contents) {
            const videoUrl = content.video;
            const tempFilePath = path.join(tempDir, `${content._id}.mp4`);

            console.log(`[Worker] Downloading video from ${videoUrl}`);
            const response = await axios({
                method: 'GET',
                url: videoUrl,
                responseType: 'stream',
            });

            const writer = fs.createWriteStream(tempFilePath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            downloadedFiles.push(tempFilePath);
            fileListContent += `file '${tempFilePath}'\n`;
        }

        fs.writeFileSync(fileListPath, fileListContent);

        // 3. Merge videos using ffmpeg
        console.log(`[Worker] Merging ${downloadedFiles.length} videos...`);
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(fileListPath)
                .inputOptions(['-f concat', '-safe 0'])
                .outputOptions('-c copy')
                .on('end', resolve)
                .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
                .save(outputPath);
        });

        // 4. Upload the merged video to Cloudinary
        console.log('[Worker] Uploading merged video to Cloudinary...');
        const uploadResult = await cloudinary.uploader.upload(outputPath, {
            resource_type: 'video',
            folder: 'videos/combined',
        });

        // 5. Create a new content document for the merged video
        const newContent = await contentSchema.create({
            title,
            description,
            category,
            credit,
            user: userId,
            video: uploadResult.secure_url,
            cloudinary_video_id: uploadResult.public_id,
            thumbnail: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_2/${uploadResult.public_id}.jpg`,
            isApproved: true, // Combined videos are pre-approved
            status: 'completed',
        });
        console.log(`[Worker] Created new content record for combined video: ${newContent._id}`);

        // 6. (Optional) Send email notification to user
        const user = await userSchema.findById(userId);
        if (user) {
            sendEmail(user.email, 'Your combined video is ready!', `<p>Your video "${title}" has been successfully created and is now available.</p>`);
        }

        return { newContentId: newContent._id, status: 'success' };

    } catch (error) {
        console.error(`[Worker] Video combination job ${job.id} failed:`, error);
        throw error; // Re-throw to let BullMQ handle the failure
    } finally {
        // 7. Cleanup temporary files and directory
        if (fs.existsSync(tempDir)) {
            fs.rm(tempDir, { recursive: true, force: true }, (err) => {
                if (err) console.error(`[Worker] Failed to clean up temp directory ${tempDir}:`, err);
                else console.log(`[Worker] Cleaned up temp directory: ${tempDir}`);
            });
        }
    }
};

const processUpload = async (job) => {
    const { contentId, languageCode, video, thumbnail } = job.data;
    let content = null;

    try {
        console.log(`[Worker] Started processing job ${job.id} for content: ${contentId}`);
        content = await contentSchema.findById(contentId).populate('user');
        if (!content) {
            throw new Error(`Content record not found in worker for job ${job.id}.`);
        }

        // The video and thumbnail URLs are already set in the controller.
        // The worker's job is to process the AI tasks and update the record.

        // B. AI Processing (can run in parallel)
        console.log(`[Worker] Starting AI processing for job ${job.id}`);

        console.log(`[Worker] [${job.id}] Task: Generating captions...`);
        const captionPromise = aiService.generateCaptions(video.url, contentId, languageCode);

        console.log(`[Worker] [${job.id}] Task: Analyzing video for moderation...`);
        const moderationPromise = aiService.analyzeVideoForModeration(video.url);

        console.log(`[Worker] [${job.id}] Task: Generating content embeddings...`);
        const embeddingPromise = aiService.generateEmbeddings({ title: content.title, description: content.description, category: content.category });

        const [captionResult, moderationResult, embeddingResult] = await Promise.allSettled([
            captionPromise,
            moderationPromise,
            embeddingPromise
        ]);

        let initialCaptions = [];
        if (captionResult.status === 'fulfilled' && captionResult.value) {
            console.log(`[Worker] [${job.id}] Task Status: Caption generation successful.`);
            initialCaptions.push({ languageCode: languageCode || 'en_us', text: captionResult.value });
        } else if (captionResult.status === 'rejected') {
            console.error(`[Worker] [${job.id}] Task Status: Failed to generate captions for ${contentId}:`, captionResult.reason);
        }

        let moderation = { status: 'needs_review', labels: [] };
        if (moderationResult.status === 'fulfilled' && moderationResult.value) {
            console.log(`[Worker] [${job.id}] Task Status: Moderation analysis successful.`);
            moderation = moderationResult.value;
        } else if (moderationResult.status === 'rejected') {
            console.error(`[Worker] [${job.id}] Task Status: Failed to analyze video for moderation for ${contentId}:`, moderationResult.reason);
        }

        let contentEmbedding = [];
        if (embeddingResult.status === 'fulfilled' && embeddingResult.value) {
            console.log(`[Worker] [${job.id}] Task Status: Content embedding generation successful.`);
            contentEmbedding = embeddingResult.value;
        } else if (embeddingResult.status === 'rejected') {
            console.error(`[Worker] [${job.id}] Task Status: Failed to generate content embeddings for ${contentId}:`, embeddingResult.reason);
        }
        console.log(`[Worker] AI processing complete for job ${job.id}`);

        // C. Update content document in the database with AI results
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

        // D. Generate highlight
        try {
            console.log(`[Worker] [${job.id}] Task: Generating highlight...`);
            const duration = await aiService.getVideoDuration(video.public_id);
            const { startTime, endTime } = aiService.generateHighlight(duration);

            const highlight = await Highlight.create({
                user: content.user._id,
                content: content._id,
                startTime,
                endTime,
            });

            content.highlight = highlight._id;
            console.log(`[Worker] [${job.id}] Task Status: Highlight generation successful.`);
        } catch (error) {
            console.error(`[Worker] [${job.id}] Task Status: Failed to generate highlight for ${contentId}:`, error);
        }

        await content.save();
        console.log(`[Worker] Content document updated for job ${job.id}`);

        // E. Send email notification for content needing review
        if (content.user.role !== 'admin' && moderation.status !== 'rejected') {
            const admins = await userSchema.find({ role: 'admin' });
            const previewUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_${content.shortPreview.start},eo_${content.shortPreview.end}/${video.public_id}.mp4`;
            admins.forEach(admin => {
                sendEmail(admin.email, 'New Content Approval Request', `<p>A new content titled "${content.title}" has been uploaded and requires your approval.</p><p><a href="${process.env.APP_URL}/admin/approve-content/${content._id}">Approve Content</a></p><p>Preview: <a href="${previewUrl}">View Preview</a></p>`);
            });
        }

        return { contentId: contentId, status: 'success' };

    } catch (error) {
        console.error(`[Worker] Job ${job.id} for content ${contentId} failed catastrophically:`, error);
        if (content) {
            // If the job fails, update the status but do not delete the content.
            console.log(`[Worker] [${job.id}] Updating content status to 'failed' due to error.`);
            content.aiModerationStatus = 'failed';
            await content.save();
            console.log(`[Worker] [${job.id}] Content status updated to 'failed'.`);
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

    worker = new Worker('upload', mainProcessor, redisConnectionOpts);

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