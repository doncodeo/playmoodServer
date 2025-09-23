// This script will be executed as a child process
// to handle heavy video upload and processing tasks without blocking the main server.

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');
const contentSchema = require('../models/contentModel');
const userSchema = require('../models/userModel');
const nodemailer = require('nodemailer');
const { compressVideo } = require('../utils/videoCompressor');
const aiService = require('../ai/ai-service');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {});
        console.log(`[Worker] MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[Worker] Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

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

const processUpload = async (jobData) => {
    const { videoFile, thumbnailFile, contentId, languageCode } = jobData;
    let compressedVideoPath = null;
    let content = null;

    try {
        console.log(`[Worker] Started processing job for content: ${contentId}`);
        content = await contentSchema.findById(contentId).populate('user');
        if (!content) {
            throw new Error('Content record not found in worker.');
        }

        // 1. Compress video
        const videoExtension = path.extname(videoFile.originalname);
        compressedVideoPath = path.join(path.dirname(videoFile.path), `compressed-${videoFile.filename}${videoExtension}`);
        await compressVideo(videoFile.path, compressedVideoPath);
        console.log(`[Worker] Video compressed for content: ${contentId}`);

        // 2. Upload video to Cloudinary
        const videoResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_large(compressedVideoPath, {
                resource_type: 'video',
                folder: 'videos',
                eager: [{ width: 1280, height: 720, crop: 'fill', gravity: 'auto', format: 'jpg', start_offset: '2' }],
                chunk_size: 20000000, // 20 MB
            }, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
        console.log(`[Worker] Video uploaded to Cloudinary for content: ${contentId}`);

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
        console.log(`[Worker] Thumbnail processed for content: ${contentId}`);

        // 4. AI Processing: Captions, Moderation, Embeddings
        let initialCaptions = [];
        try {
            const captionText = await aiService.generateCaptions(videoResult.secure_url, contentId, languageCode);
            if (captionText) {
                initialCaptions.push({ languageCode: languageCode || 'en_us', text: captionText });
            }
        } catch (captionError) {
            console.error(`[Worker] Failed to generate captions for ${contentId}:`, captionError);
        }

        let moderationResult = { status: 'needs_review', labels: [] };
        try {
            moderationResult = await aiService.analyzeVideoForModeration(videoResult.secure_url);
        } catch (moderationError) {
            console.error(`[Worker] Failed to analyze video for moderation for ${contentId}:`, moderationError);
        }

        let contentEmbedding = [];
        try {
            contentEmbedding = await aiService.generateEmbeddings({ title: content.title, description: content.description, category: content.category });
        } catch (embeddingError) {
            console.error(`[Worker] Failed to generate content embeddings for ${contentId}:`, embeddingError);
        }
        console.log(`[Worker] AI processing complete for content: ${contentId}`);

        // 5. Update content document with all the new data
        content.status = 'completed';
        content.video = videoResult.secure_url;
        content.cloudinary_video_id = videoResult.public_id;
        content.thumbnail = thumbnailUrl;
        content.cloudinary_thumbnail_id = cloudinaryThumbnailId;
        content.captions = initialCaptions;
        content.aiModerationStatus = moderationResult.status;
        content.aiModerationLabels = moderationResult.labels;
        content.contentEmbedding = contentEmbedding;

        // Determine approval status
        let isApproved = content.user.role === 'admin';
        if (moderationResult.status === 'approved' && content.user.role !== 'admin') {
            isApproved = true;
        } else if (moderationResult.status === 'rejected') {
            isApproved = false;
            content.rejectionReason = `Content automatically rejected by AI due to: ${moderationResult.labels.join(', ')}`;
        }
        content.isApproved = isApproved;

        await content.save();
        console.log(`[Worker] Content document updated for: ${contentId}`);

        // 6. Send email notification if needed
        if (!isApproved) {
            const admins = await userSchema.find({ role: 'admin' });
            const previewUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_${content.shortPreview.start},eo_${content.shortPreview.end}/${videoResult.public_id}.mp4`;
            admins.forEach(admin => {
                sendEmail(admin.email, 'New Content Approval Request', `<p>A new content titled "${content.title}" has been uploaded and requires your approval.</p><p><a href="${process.env.APP_URL}/admin/approve-content/${content._id}">Approve Content</a></p><p>Preview: <a href="${previewUrl}">View Preview</a></p>`);
            });
        }

        console.log(`[Worker] Job for content ${contentId} completed successfully.`);

    } catch (error) {
        console.error(`[Worker] Job for content ${contentId} failed:`, error);
        if (content) {
            await contentSchema.findByIdAndDelete(contentId);
            console.log(`[Worker] Deleted content document for failed job: ${contentId}`);
        }
    } finally {
        // 7. Cleanup temp files
        const filesToDelete = [videoFile?.path, thumbnailFile?.path, compressedVideoPath];
        filesToDelete.forEach(filePath => {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`[Worker] Failed to delete temp file: ${filePath}`, err);
                });
            }
        });
        if (process.env.NODE_ENV !== 'test') {
            process.exit(0);
        }
    }
};

if (require.main === module) {
    process.on('message', async (jobData) => {
        await connectDB();
        await processUpload(jobData);
    });
}

module.exports = { processUpload };
