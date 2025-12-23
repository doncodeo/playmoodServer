const axios = require('axios');
const cloudinary = require('../config/cloudinary');
const { pipeline } = require('@xenova/transformers');

// This service will act as an abstraction layer for our AI models and services.
// It will expose a set of functions that our application can use without needing
// to know the specifics of the underlying AI implementation.

class AIService {
    constructor() {
        this.heygen = axios.create({
            baseURL: 'https://api.heygen.com/v2',
            headers: {
                'x-api-key': process.env.HEYGEN_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        // Lazily initialize the feature extraction pipeline
        this.extractor = null;
        this.initializingExtractor = this.initExtractor();
    }

    async initExtractor() {
        try {
            this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            console.log('Feature extraction model loaded successfully.');
        } catch (error) {
            console.error('Error loading feature extraction model:', error);
            // We don't throw here to avoid crashing the app on startup if the model fails to load.
            // The generateEmbeddings function will handle the case where the extractor is null.
        }
    }


    /**
     * Generates captions for a video or audio file from a URL.
     * @param {string} url - The public URL to the video or audio file.
     * @param {string} contentId - The ID of the content being processed.
     * @param {string} languageCode - The language code for transcription.
     * @returns {Promise<string>} The generated transcript.
     */
    async generateCaptions(url, contentId, languageCode = 'en') {
        console.log(`[${contentId}] AI Service: Starting caption generation for ${url} with language ${languageCode}`);
        try {
            // This now uses the AssemblyAI-based transcription service.
            const transcriptionService = require('./transcription-service');
            const transcript = await transcriptionService.transcribe(url, languageCode, contentId);
            console.log(`[${contentId}] Transcription complete.`);
            return transcript;
        } catch (error) {
            console.error(`[${contentId}] An error occurred during transcription:`, error);
            throw new Error(`Transcription error: ${error.message}`);
        }
    }

    /**
     * Generates a vector embedding for a piece of content.
     * @param {object} content - The content object (with title, description, category).
     * @returns {Promise<Array<number>|null>} The generated embedding, or null if an error occurs.
     */
    async generateEmbeddings(content) {
        console.log(`AI Service: Generating embeddings for content: "${content.title}"`);
        try {
            await this.initializingExtractor; // Ensure the model is loaded
            if (!this.extractor) {
                throw new Error('Feature extraction model is not available.');
            }

            // Concatenate the most relevant text fields to create a descriptive string
            const textToEmbed = `${content.title}. ${content.description}. Category: ${content.category}.`;

            // Generate the embedding
            const output = await this.extractor(textToEmbed, {
                pooling: 'mean',
                normalize: true,
            });

            // The output tensor contains the embedding. Convert it to a regular array.
            const embedding = Array.from(output.data);

            console.log(`AI Service: Successfully generated a ${embedding.length}-dimensional embedding.`);
            return embedding;
        } catch (error) {
            console.error(`An error occurred during embedding generation for content "${content.title}":`, error.message);
            // Return null or handle the error as appropriate for your application
            return null;
        }
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
            status: 'approved',
            labels: []
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

    /**
     * Gets the duration of a video from Cloudinary.
     * @param {string} publicId - The public ID of the video in Cloudinary.
     * @returns {Promise<number>} The duration of the video in seconds.
     */
    async getVideoDuration(publicId) {
        console.log(`AI Service: Getting duration for video with public ID: ${publicId}`);
        try {
            const result = await cloudinary.api.resource(publicId, {
                resource_type: 'video',
                image_metadata: true, // Requesting metadata to ensure duration is included
            });
            if (result && result.duration) {
                console.log(`AI Service: Found duration: ${result.duration}`);
                return result.duration;
            }
            throw new Error('Could not retrieve video duration from Cloudinary.');
        } catch (error) {
            console.error(`An error occurred while fetching video duration for ${publicId}:`, error);
            throw new Error(`Cloudinary API error while fetching video duration: ${error.message}`);
        }
    }

    /**
     * Generates start and end times for a highlight clip based on video duration.
     * The highlight will be between 10 and 30 seconds long.
     * @param {number} duration - The total duration of the video in seconds.
     * @returns {{startTime: number, endTime: number}} An object with start and end times.
     */
    generateHighlight(duration) {
        console.log(`AI Service: Generating highlight for video with duration: ${duration}s`);
        const minHighlightDuration = 10;
        const maxHighlightDuration = 30;

        if (duration <= minHighlightDuration) {
            return { startTime: 0, endTime: duration };
        }

        let highlightDuration = Math.round(duration * 0.2);
        highlightDuration = Math.max(minHighlightDuration, Math.min(maxHighlightDuration, highlightDuration));

        const startTime = Math.max(0, (duration / 2) - (highlightDuration / 2));
        const endTime = Math.min(duration, startTime + highlightDuration);

        console.log(`AI Service: Generated highlight from ${startTime.toFixed(2)}s to ${endTime.toFixed(2)}s`);
        return { startTime: parseFloat(startTime.toFixed(2)), endTime: parseFloat(endTime.toFixed(2)) };
    }
}

module.exports = new AIService();