const axios = require('axios');

// A utility function to delay execution, used for polling.
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Converts a language code (e.g., 'es') to its full name (e.g., 'Spanish')
 * for use in the LeMUR translation prompt.
 * @param {string} code - The language code.
 * @returns {string} The full language name.
 */
const getLanguageName = (code) => {
    const languageNames = {
        es: 'Spanish',
        fr: 'French',
        de: 'German',
        it: 'Italian',
        pt: 'Portuguese',
        // Add more languages as needed
    };
    return languageNames[code.toLowerCase()] || code;
};

/**
 * Parses a VTT file string into an array of caption segments.
 * Each segment is an object with 'timestamp' and 'text' properties.
 * @param {string} vttString - The VTT file content as a string.
 * @returns {Array<{timestamp: string, text: string}>} The parsed caption segments.
 */
const parseVtt = (vttString) => {
    const lines = vttString.trim().split('\n');
    const segments = [];
    let currentSegment = null;

    for (const line of lines) {
        if (line.includes('-->')) {
            if (currentSegment) {
                segments.push(currentSegment);
            }
            currentSegment = { timestamp: line, text: '' };
        } else if (currentSegment && line.trim() !== '' && !line.startsWith('WEBVTT')) {
            currentSegment.text += (currentSegment.text ? ' ' : '') + line.trim();
        }
    }
    if (currentSegment) {
        segments.push(currentSegment);
    }
    return segments;
};

/**
 * Reconstructs a VTT file string from an array of caption segments.
 * @param {Array<{timestamp: string, text: string}>} segments - The caption segments.
 * @returns {string} The VTT file content as a string.
 */
const reconstructVtt = (segments) => {
    let vtt = 'WEBVTT\n\n';
    for (const segment of segments) {
        vtt += `${segment.timestamp}\n${segment.text}\n\n`;
    }
    return vtt;
};

class TranscriptionService {
    constructor() {
        // Axios instance for the main v2 API
        this.assembly = axios.create({
            baseURL: 'https://api.assemblyai.com/v2',
            headers: {
                authorization: process.env.ASSEMBLYAI_API_KEY,
                'content-type': 'application/json',
            },
        });

        // Separate Axios instance for the LeMUR API
        this.lemur = axios.create({
            baseURL: 'https://api.assemblyai.com/lemur',
            headers: {
                authorization: process.env.ASSEMBLYAI_API_KEY,
                'content-type': 'application/json',
            },
        });
    }

    /**
     * Translates a single caption segment using the LeMUR API.
     * @param {string} text - The text to translate.
     * @param {string} languageName - The target language name.
     * @returns {Promise<string>} The translated text.
     */
    async translateSegment(text, languageName) {
        try {
            const lemurResponse = await this.lemur.post('', {
                context: "This is a caption from a video, so keep the translation concise.",
                prompt: `Translate the following text into ${languageName}: "${text}"`,
            });
            // LeMUR's basic endpoint is synchronous and returns the response directly
            return lemurResponse.data.response.trim();
        } catch (error) {
            console.error('Error translating segment:', error.response ? error.response.data : error.message);
            return text; // Fallback to original text on error
        }
    }

    /**
     * Transcribes or translates a video/audio file using the AssemblyAI API.
     * @param {string} url - The public URL of the video or audio file.
     * @param {string} languageCode - The target language code for transcription or translation.
     * @param {string} contentId - The ID of the content being processed for logging.
     * @returns {Promise<string>} The transcription in VTT format.
     */
    async transcribe(url, languageCode = 'en', contentId = 'N/A') {
        console.log(`[${contentId}] Transcription Service: Starting process for ${url} with target language ${languageCode}`);

        try {
            // Step 1: Submit the transcription job, enabling language detection to find the source language.
            const submitResponse = await this.assembly.post('/transcript', {
                audio_url: url,
                language_detection: true, // Let AssemblyAI detect the source language
            });
            const transcriptId = submitResponse.data.id;
            console.log(`[${contentId}] AssemblyAI transcription job submitted with ID: ${transcriptId}`);

            // Step 2: Poll for the transcription to complete.
            let transcriptData;
            while (true) {
                const pollResponse = await this.assembly.get(`/transcript/${transcriptId}`);
                const status = pollResponse.data.status;

                if (status === 'completed') {
                    transcriptData = pollResponse.data;
                    console.log(`[${contentId}] Transcription complete. Detected language: ${transcriptData.language_code}`);
                    break;
                } else if (status === 'error') {
                    const errorMessage = pollResponse.data.error || 'Unknown AssemblyAI error';
                    throw new Error(`AssemblyAI transcription failed: ${errorMessage}`);
                }

                console.log(`[${contentId}] Transcription status for ${transcriptId}: ${status}. Polling...`);
                await delay(10000);
            }

            const sourceLanguage = transcriptData.language_code;

            // Step 3: Fetch the timestamped VTT in the source language.
            const vttResponse = await this.assembly.get(`/transcript/${transcriptId}/vtt`);
            const sourceVtt = vttResponse.data;

            // Step 4: If the target language is the same as the source, return the standard timestamped VTT.
            if (languageCode.startsWith(sourceLanguage)) {
                console.log(`[${contentId}] Target language matches source. Returning original VTT.`);
                return sourceVtt;
            }

            // Step 5: If languages differ, perform the two-pass translation.
            console.log(`[${contentId}] Target language differs. Initiating two-pass translation to ${languageCode}.`);

            const vttSegments = parseVtt(sourceVtt);
            const languageName = getLanguageName(languageCode);
            const translatedSegments = [];

            for (const segment of vttSegments) {
                const translatedText = await this.translateSegment(segment.text, languageName);
                translatedSegments.push({ timestamp: segment.timestamp, text: translatedText });
                // Small delay to avoid hitting API rate limits
                await delay(500);
            }

            // Step 6: Reconstruct the VTT with translated text.
            return reconstructVtt(translatedSegments);

        } catch (error) {
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error(`[${contentId}] An error occurred in the AssemblyAI process:`, errorMessage);
            throw new Error(`Failed to process video: ${errorMessage}`);
        }
    }
}

module.exports = new TranscriptionService();
