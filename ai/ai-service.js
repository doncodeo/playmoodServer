const { AssemblyAI } = require('assemblyai');
const axios = require('axios');
const contentSchema = require('../models/contentModel');

// This service will act as an abstraction layer for our AI models and services.
// It will expose a set of functions that our application can use without needing
// to know the specifics of the underlying AI implementation.

class AIService {
    constructor() {
        if (process.env.ASSEMBLYAI_API_KEY) {
            this.assemblyai = new AssemblyAI({
                apiKey: process.env.ASSEMBLYAI_API_KEY,
            });
        } else {
            this.assemblyai = null;
        }
        this.heygen = axios.create({
            baseURL: 'https://api.heygen.com/v2',
            headers: {
                'x-api-key': process.env.HEYGEN_API_KEY,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Generates captions for a video or audio file from a URL.
     * @param {string} url - The public URL to the video or audio file.
     * @param {string} contentId - The ID of the content being processed.
     * @param {string} languageCode - The language code for transcription.
     * @returns {Promise<string>} The generated transcript.
     */
    async generateCaptions(url, contentId, languageCode = 'en_us') {
        if (!this.assemblyai) {
            console.warn(`[${contentId}] AssemblyAI service is not initialized due to missing API key. Skipping caption generation.`);
            return null;
        }
        console.log(`[${contentId}] AI Service: Starting caption generation for ${url} with language ${languageCode}`);

        try {
            const transcript = await this.assemblyai.transcripts.transcribe({
                audio: url,
                language_code: languageCode,
            });

            if (transcript.status === 'error') {
                throw new Error(`Transcription failed: ${transcript.error}`);
            }

            console.log(`[${contentId}] Transcription complete.`);
            return transcript.text;
        } catch (error) {
            console.error(`[${contentId}] An error occurred during transcription:`, error);
            throw new Error(`AssemblyAI error: ${error.message}`);
        }
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

    async getSupportedLanguages() {
        console.log(`AI Service: Fetching supported languages from Heygen`);
        try {
            const response = await this.heygen.get('/video_translate/target_languages');
            return response.data.data.languages;
        } catch (error) {
            console.error(`An error occurred while fetching supported languages:`, error.response ? error.response.data : error.message);
            throw new Error(`Heygen API error: ${error.message}`);
        }
    }

    /**
     * Initiates video translation using the Heygen API.
     * @param {string} videoUrl - The public URL of the video to translate.
     * @param {string} contentId - The ID of the content being processed.
     * @param {string} language - The target language for translation.
     * @returns {Promise<string>} The video translate ID.
     */
    async translateVideo(videoUrl, contentId, language) {
        console.log(`[${contentId}] AI Service: Initiating video translation to ${language} for ${videoUrl}`);
        try {
            const response = await this.heygen.post('/video_translate', {
                video_url: videoUrl,
                output_language: language,
                title: `Translated Video for ${contentId}`
            });
            const videoTranslateId = response.data.data.video_translate_id;
            console.log(`[${contentId}] Video translation initiated with ID: ${videoTranslateId}`);
            return videoTranslateId;
        } catch (error) {
            console.error(`[${contentId}] An error occurred during video translation initiation:`, error.response ? error.response.data : error.message);
            throw new Error(`Heygen API error: ${error.message}`);
        }
    }

    /**
     * Checks the status of a video translation job.
     * @param {string} videoTranslateId - The ID of the video translation job.
     * @returns {Promise<object>} The status data from Heygen.
     */
    async checkTranslationStatus(videoTranslateId) {
        console.log(`AI Service: Checking translation status for ID: ${videoTranslateId}`);
        try {
            const response = await this.heygen.get(`/video_translate/${videoTranslateId}`);
            // The 'eta' field is not officially documented, but we check for it here.
            const statusData = response.data.data;
            if (statusData.eta) {
                console.log(`[${videoTranslateId}] ETA received: ${statusData.eta} seconds`);
            }
            return statusData;
        } catch (error) {
            console.error(`An error occurred while checking translation status for ID ${videoTranslateId}:`, error.response ? error.response.data : error.message);
            throw new Error(`Heygen API error: ${error.message}`);
        }
    }
}

module.exports = new AIService();
