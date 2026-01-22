const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const path = require('path');
const os = require('os');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

class MediaProcessor {
    /**
     * Get video metadata (duration, resolution, etc.)
     */
    async getMetadata(inputPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(inputPath, (err, metadata) => {
                if (err) return reject(err);
                resolve(metadata);
            });
        });
    }

    /**
     * Extract thumbnail from video
     */
    async extractThumbnail(inputPath, time = '00:00:01') {
        const outputPath = path.join(os.tmpdir(), `thumb-${Date.now()}.jpg`);
        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                .inputOptions([`-ss ${time}`]) // Fast seek before input
                .outputOptions(['-vframes 1']);

            const timeout = setTimeout(() => {
                command.kill('SIGKILL');
                reject(new Error('Thumbnail extraction timed out'));
            }, 60000); // 1 minute timeout

            command
                .on('end', () => {
                    clearTimeout(timeout);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                })
                .save(outputPath);
        });
    }

    /**
     * Extract highlight clip
     */
    async extractHighlight(inputPath, startTime, duration = 10) {
        const outputPath = path.join(os.tmpdir(), `highlight-${Date.now()}.mp4`);
        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                .inputOptions([`-ss ${startTime}`]) // Fast seek
                .outputOptions([
                    `-t ${duration}`,
                    '-c:v libx264',
                    '-preset ultrafast', // Low CPU usage for generation
                    '-crf 28', // Lower quality/filesize for highlights
                    '-c:a aac',
                    '-b:a 128k',
                    '-threads 1' // Limit CPU usage
                ]);

            const timeout = setTimeout(() => {
                command.kill('SIGKILL');
                reject(new Error('Highlight extraction timed out'));
            }, 300000); // 5 minutes timeout

            command
                .on('end', () => {
                    clearTimeout(timeout);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                })
                .save(outputPath);
        });
    }

    /**
     * Extract audio for AI services
     */
    async extractAudio(inputPath) {
        const outputPath = path.join(os.tmpdir(), `audio-${Date.now()}.mp3`);
        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                .outputOptions([
                    '-vn',
                    '-acodec libmp3lame',
                    '-ac 1', // Mono
                    '-ar 16000', // 16kHz
                    '-threads 1'
                ]);

            const timeout = setTimeout(() => {
                command.kill('SIGKILL');
                reject(new Error('Audio extraction timed out'));
            }, 300000); // 5 minutes timeout

            command
                .on('end', () => {
                    clearTimeout(timeout);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                })
                .save(outputPath);
        });
    }
}

module.exports = new MediaProcessor();
