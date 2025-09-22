// This script will be executed as a child process
// to handle heavy video processing tasks without blocking the main server.

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path =require('path');
const fs = require('fs');
const axios = require('axios');
const { getSilentParts } = require('@remotion/renderer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
const cloudinary = require('../config/cloudinary');
const contentSchema = require('../models/contentModel');
const userSchema = require('../models/userModel');
const nodemailer = require('nodemailer');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
        });
        console.log(`MongoDB Connected in worker: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB in worker: ${error.message}`);
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
            console.error('Error sending email from worker:', error);
        } else {
            console.log('Email sent from worker:', info.response);
        }
    });
};

const processVideo = async (jobData) => {
    const { contentIds, title, category, description, credit, userId } = jobData;

    const user = await userSchema.findById(userId);
    if (!user) {
        console.error('User not found in worker');
        return;
    }

    const adminEmail = user.email;
    const tempDir = path.join(__dirname, '..', 'temp_worker');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const downloadedPaths = [];
    const segmentPaths = []; // To store paths of individual audible segments
    const concatListPath = path.join(tempDir, 'concat-list.txt');
    const finalVideoPath = path.join(tempDir, `final-${Date.now()}.mp4`);

    try {
        console.log('Worker started processing job for user:', userId);

        // 1. Fetch content documents and get video URLs
        const contents = await contentSchema.find({ '_id': { $in: contentIds } });
        const videoUrls = contents.map(c => c.video);

        // 2. Download videos from Cloudinary
        for (const url of videoUrls) {
            const tempFilePath = path.join(tempDir, `video-${Date.now()}-${path.basename(url)}`);
            const response = await axios({ url, responseType: 'stream' });
            const writer = fs.createWriteStream(tempFilePath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            downloadedPaths.push(tempFilePath);
        }

        // 3. For each downloaded video, extract its audible parts into separate segment files
        let segmentIndex = 0;
        for (const videoPath of downloadedPaths) {
            const { audibleParts } = await getSilentParts({ src: videoPath });
            const validAudibleParts = audibleParts.filter(part => part.endInSeconds > part.startInSeconds);

            if (validAudibleParts.length === 0) {
                // If a whole clip is silent, we can choose to skip it.
                console.log(`Skipping a video with no audible parts: ${videoPath}`);
                continue;
            }

            for (const part of validAudibleParts) {
                const segmentPath = path.join(tempDir, `segment-${segmentIndex++}.mp4`);
                await new Promise((resolve, reject) => {
                    ffmpeg(videoPath)
                        .setStartTime(part.startInSeconds)
                        .setDuration(part.endInSeconds - part.startInSeconds)
                        .outputOptions('-c:v libx264', '-c:a libmp3lame') // Re-encode to avoid issues
                        .on('error', reject)
                        .on('end', () => resolve())
                        .save(segmentPath);
                });
                segmentPaths.push(segmentPath);
            }
        }

        // 4. If we have segments, concatenate them using the concat demuxer
        if (segmentPaths.length > 0) {
            const fileContent = segmentPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
            fs.writeFileSync(concatListPath, fileContent);

            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(concatListPath)
                    .inputOptions(['-f concat', '-safe 0'])
                    .outputOptions('-c copy') // The segments are already encoded, so we can just copy
                    .on('error', reject)
                    .on('end', () => resolve())
                    .save(finalVideoPath);
            });
        } else {
            console.warn('No audible segments were found to create a video.');
            // Create an empty file to avoid crashing on upload
            fs.closeSync(fs.openSync(finalVideoPath, 'w'));
        }

        // 5. Upload final video to Cloudinary
        const videoResult = await cloudinary.uploader.upload(finalVideoPath, {
            resource_type: 'video',
            folder: 'videos',
            eager: [{ width: 1280, height: 720, crop: 'fill', gravity: 'auto', format: 'jpg', start_offset: '2' }],
        });
        const thumbnailUrl = videoResult.eager && videoResult.eager[0] ? videoResult.eager[0].secure_url : '';

        // 6. Create new content document
        await contentSchema.create({
            user: userId,
            title,
            category,
            description,
            credit,
            thumbnail: thumbnailUrl,
            video: videoResult.secure_url,
            cloudinary_video_id: videoResult.public_id,
            cloudinary_thumbnail_id: '',
            isApproved: true,
        });

        sendEmail(adminEmail, 'Video Combination Complete', `<p>Your video "${title}" has been successfully combined and is now available.</p>`);
        console.log('Worker finished processing job.');

    } catch (error) {
        console.error('Error in video processing worker:', error);
        sendEmail(adminEmail, 'Video Combination Failed', `<p>There was an error processing your video "${title}". Please try again.</p><p>Error: ${error.message}</p>`);
    } finally {
        // Cleanup temp files
        const allTempFiles = [...downloadedPaths, ...segmentPaths, concatListPath, finalVideoPath];
        allTempFiles.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`Failed to delete temp file from worker: ${filePath}`, err);
                });
            }
        });
        if (fs.existsSync(tempDir)) {
            fs.rmdir(tempDir, { recursive: true }, (err) => {
                if (err) console.error('Failed to remove temp directory:', err);
            });
        }
        process.exit(0);
    }
};


process.on('message', async (jobData) => {
    await connectDB();
    await processVideo(jobData);
});
