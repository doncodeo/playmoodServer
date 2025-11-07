const ffmpeg = require('fluent-ffmpeg');
const https = require('https');
const http = require('http');
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
        const size = '1280x720';
        const tempFolder = os.tmpdir();
        const tempVideoPath = path.join(tempFolder, `video-${Date.now()}.mp4`);
        let tempThumbnailPath = '';

        const protocol = videoUrl.startsWith('https') ? https : http;

        const request = protocol.get(videoUrl, (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                return reject(new Error(`Failed to download video. Status code: ${response.statusCode}`));
            }
            const fileStream = fs.createWriteStream(tempVideoPath);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();

                ffmpeg(tempVideoPath)
                    .on('filenames', (filenames) => {
                        tempThumbnailPath = path.join(tempFolder, filenames[0]);
                    })
                    .on('end', () => {
                        if (!fs.existsSync(tempThumbnailPath)) {
                            fs.unlink(tempVideoPath, () => {});
                            return reject(new Error('Thumbnail file was not created.'));
                        }
                        cloudinary.uploader.upload(tempThumbnailPath, {
                            folder: "feed_thumbnails",
                            resource_type: "image",
                        }, (error, result) => {
                            fs.unlink(tempVideoPath, (err) => {
                                if (err) console.error("Error deleting temp video file:", err);
                            });
                            fs.unlink(tempThumbnailPath, (err) => {
                                if (err) console.error("Error deleting temp thumbnail file:", err);
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
                        fs.unlink(tempVideoPath, () => {});
                        if (tempThumbnailPath && fs.existsSync(tempThumbnailPath)) {
                            fs.unlink(tempThumbnailPath, () => {});
                        }
                        reject(new Error('Failed to generate thumbnail.'));
                    })
                    .screenshots({
                        timestamps: [timestamp],
                        filename: `thumbnail-${Date.now()}.png`,
                        folder: tempFolder,
                        size: size,
                    });
            });

            fileStream.on('error', (err) => {
                fs.unlink(tempVideoPath, () => {});
                reject(new Error('Failed to write video to temporary file.'));
            });
        });

        request.on('error', (err) => {
            reject(new Error('Failed to download video.'));
        });
    });
};

module.exports = { generateThumbnail };
