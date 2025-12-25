const axios = require('axios');

// A utility function to delay execution, used for polling.
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Converts a language code (e.g., 'es') to its full name (e.g., 'Spanish').
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
        // Axios instance for the main v2 API (transcription)
        this.assembly = axios.create({
            baseURL: 'https://api.assemblyai.com/v2',
            headers: {
                authorization: process.env.ASSEMBLYAI_API_KEY,
                'content-type': 'application/json',
            },
        });

        // NEW Axios instance for the LLM Gateway API (translation)
        this.llmGateway = axios.create({
            baseURL: 'https://llm-gateway.assemblyai.com/v1',
            headers: {
                authorization: process.env.ASSEMBLYAI_API_KEY,
                'content-type': 'application/json',
            },
        });
    }

    /**
     * Translates a single caption segment using the AssemblyAI LLM Gateway.
     * @param {string} text - The text to translate.
     * @param {string} languageName - The target language name.
     * @returns {Promise<string>} The translated text.
     */
    async translateSegment(text, languageName) {
        // ADDING THIS LOG TO PROVE THE NEW CODE IS RUNNING
        console.log(`[Translation] Calling LLM Gateway to translate to ${languageName}.`);
        try {
            const response = await this.llmGateway.post('/chat/completions', {
                model: 'claude-3-haiku-20240307', // Using a fast and capable model
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert translator. Translate the user\'s text accurately and concisely for video captions.'
                    },
                    {
                        role: 'user',
                        content: `Translate the following English text to ${languageName}: "${text}"`
                    }
                ]
            });

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                return response.data.choices[0].message.content.trim();
            }
            // Fallback if the response format is unexpected
            console.warn('[Translation] LLM Gateway response was empty or malformed.');
            return text;

        } catch (error) {
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error(`[Translation] Error translating segment: ${errorMessage}`);
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
            // Step 1: Submit the transcription job, enabling language detection.
            const submitResponse = await this.assembly.post('/transcript', {
                audio_url: url,
                language_detection: true,
            });
            const transcriptId = submitResponse.data.id;
            console.log(`[${contentId}] AssemblyAI transcription job submitted with ID: ${transcriptId}`);

            // Step 2: Poll for completion.
            let transcriptData;
            while (true) {
                const pollResponse = await this.assembly.get(`/transcript/${transcriptId}`);
                const status = pollResponse.data.status;

                if (status === 'completed') {
                    transcriptData = pollResponse.data;
                    console.log(`[${contentId}] Transcription complete. Detected language: ${transcriptData.language_code}`);
                    break;
                } else if (status === 'error') {
                    throw new Error(`AssemblyAI transcription failed: ${pollResponse.data.error}`);
                }
                console.log(`[${contentId}] Transcription status for ${transcriptId}: ${status}. Polling...`);
                await delay(10000);
            }

            const sourceLanguage = transcriptData.language_code;

            // Step 3: Get the timestamped VTT.
            const vttResponse = await this.assembly.get(`/transcript/${transcriptId}/vtt`);
            const sourceVtt = vttResponse.data;

            // Step 4: If no translation is needed, return the original VTT.
            if (languageCode.startsWith(sourceLanguage) || languageCode === 'en') {
                console.log(`[${contentId}] Target language (${languageCode}) matches source (${sourceLanguage}). No translation needed.`);
                return sourceVtt;
            }

            // Step 5: If translation is needed, use the two-pass pipeline.
            console.log(`[${contentId}] Target language differs. Initiating two-pass translation to ${languageCode}.`);
            const vttSegments = parseVtt(sourceVtt);
            const languageName = getLanguageName(languageCode);
            const translatedSegments = [];

            for (const segment of vttSegments) {
                const translatedText = await this.translateSegment(segment.text, languageName);
                translatedSegments.push({ timestamp: segment.timestamp, text: translatedText });
                await delay(250); // Small delay to respect rate limits
            }

            // Step 6: Reconstruct and return the translated VTT.
            return reconstructVtt(translatedSegments);

        } catch (error) {
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error(`[${contentId}] An error occurred in the AssemblyAI process:`, errorMessage);
            throw new Error(`Failed to process video: ${errorMessage}`);
        }
    }
}

module.exports = new TranscriptionService();
