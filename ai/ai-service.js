const whisper = require('nodejs-whisper');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// This service will act as an abstraction layer for our AI models and services.
// It will expose a set of functions that our application can use without needing
// to know the specifics of the underlying AI implementation.

class AIService {
    constructor() {
        // In the future, we might initialize connections to AI providers here.
        // For now, with local models, we might load them here.
    }

    /**
     * Generates captions for a video file.
     * @param {string} videoPath - The local path to the video file.
     * @param {string} contentId - The ID of the content being processed.
     * @returns {Promise<string>} The generated transcript.
     */
    async generateCaptions(videoPath, contentId) {
        console.log(`[${contentId}] AI Service: Starting caption generation for ${videoPath}`);

        const audioPath = path.join(path.dirname(videoPath), `${path.basename(videoPath, path.extname(videoPath))}.wav`);

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .toFormat('wav')
                .audioFrequency(16000)
                .on('error', (err) => {
                    console.error(`[${contentId}] An error occurred during audio extraction: ${err.message}`);
                    reject(new Error(`FFmpeg error: ${err.message}`));
                })
                .on('end', async () => {
                    console.log(`[${contentId}] Audio extracted to ${audioPath}`);
                    try {
                        // It's better to handle the model loading and other whisper options here.
                        // For now, we're keeping it simple as per the original implementation.
                        const transcript = await whisper(audioPath, {
                            modelName: "base.en", // Using a specific model
                            whisperOptions: {
                                "-fp16": true, // Enable half-precision for faster processing if supported
                                "-nt": true // No timestamps
                            }
                        });
                        console.log(`[${contentId}] Transcription complete.`);
                        fs.unlinkSync(audioPath); // Clean up the audio file
                        // The whisper library may return an array of objects or a single string.
                        // Let's ensure we return a string.
                        const resultText = Array.isArray(transcript) ? transcript.map(t => t.text).join(' ').trim() : transcript;
                        resolve(resultText);
                    } catch (error) {
                        console.error(`[${contentId}] An error occurred during transcription:`, error);
                        reject(new Error(`Whisper error: ${error.message}`));
                    }
                })
                .save(audioPath);
        });
    }

    /**
     * Generates a vector embedding for a piece of content.
     * @param {object} content - The content object (with title, description, category).
     * @returns {Promise<Array<number>>} The generated embedding.
     */
    async generateEmbeddings(content) {
        // TODO: Implement content embedding generation.
        console.log(`AI Service: Generating embeddings for content: "${content.title}"`);
        // Placeholder implementation
        return Promise.resolve(Array(128).fill(Math.random()));
    }

    /**
     * Analyzes a video for content moderation.
     * @param {string} videoUrl - The URL of the video to analyze.
     * @returns {Promise<object>} An object with moderation status and labels.
     */
    async analyzeVideoForModeration(videoUrl) {
        // TODO: Implement video moderation.
        console.log(`AI Service: Analyzing video for moderation: ${videoUrl}`);
        // Placeholder implementation
        return Promise.resolve({
            status: 'needs_review',
            labels: ['placeholder_label']
        });
    }

    /**
     * Moderates a user-submitted comment.
     * @param {string} commentText - The text of the comment.
     * @returns {Promise<object>} An object with moderation status.
     */
    async moderateComment(commentText) {
        // TODO: Implement comment moderation.
        console.log(`AI Service: Moderating comment: "${commentText}"`);
        // Placeholder implementation
        return Promise.resolve({ status: 'approved' });
    }
}

module.exports = new AIService();
