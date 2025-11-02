const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const cloudinary = require('cloudinary').v2;
const path = require('path');
const os = require('os');
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const generateThumbnail = (videoUrl) => {
    return new Promise((resolve, reject) => {
        const timestamp = '00:00:01';
        const size = '300x200';
        const tempFileName = `thumbnail-${Date.now()}.png`;
        const tempFilePath = path.join(os.tmpdir(), tempFileName);

        ffmpeg(videoUrl)
            .on('end', () => {
                // Upload to Cloudinary from the local file
                cloudinary.uploader.upload(tempFilePath, {
                    folder: "feed_thumbnails",
                    resource_type: "image",
                }, (error, result) => {
                    // Delete the temporary file
                    fs.unlink(tempFilePath, (err) => {
                        if (err) console.error("Error deleting temp file:", err);
                    });

                    if (error) {
                        console.error("Cloudinary Upload Error:", error);
                        return reject(new Error('Failed to upload thumbnail.'));
                    }

                    resolve({
                        url: result.secure_url,
                        public_id: result.public_id,
                    });
                });
            })
            .on('error', (err) => {
                console.error("FFMPEG Error:", err);
                // Ensure the temp file is deleted on error as well
                fs.unlink(tempFilePath, (unlinkErr) => {
                    if (unlinkErr) console.error("Error deleting temp file on FFMPEG error:", unlinkErr);
                });
                reject(new Error('Failed to generate thumbnail.'));
            })
            .screenshots({
                timestamps: [timestamp],
                filename: tempFileName,
                folder: os.tmpdir(),
                size: size,
            });
    });
};

module.exports = { generateThumbnail };
