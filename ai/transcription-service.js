const axios = require('axios');

// A utility function to delay execution, used for polling.
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Converts milliseconds to VTT timestamp format (HH:MM:SS.mmm).
 * @param {number} ms - The timestamp in milliseconds.
 * @returns {string} The formatted timestamp string.
 */
const formatTimestamp = (ms) => {
    const date = new Date(ms);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

/**
 * Reconstructs a VTT file string from translated utterances.
 * @param {Array<Object>} utterances - The array of utterance objects from AssemblyAI.
 * @param {string} languageCode - The target language code for the translation.
 * @returns {string} The VTT file content as a string.
 */
const reconstructVttFromUtterances = (utterances, languageCode) => {
    let vtt = 'WEBVTT\n\n';
    if (utterances) {
        for (const utterance of utterances) {
            // Check if a translation for the target language exists for this utterance.
            if (utterance.translated_texts && utterance.translated_texts[languageCode]) {
                const start = formatTimestamp(utterance.start);
                const end = formatTimestamp(utterance.end);
                const translatedText = utterance.translated_texts[languageCode];
                vtt += `${start} --> ${end}\n${translatedText}\n\n`;
            }
        }
    }
    return vtt;
};

class TranscriptionService {
    constructor() {
        this.assembly = axios.create({
            baseURL: 'https://api.assemblyai.com/v2',
            headers: {
                authorization: process.env.ASSEMBLYAI_API_KEY,
                'content-type': 'application/json',
            },
        });
    }

    /**
     * Transcribes or translates a video/audio file using a single, efficient API call.
     * @param {string} url - The public URL of the video or audio file.
     * @param {string} languageCode - The target language code for transcription or translation.
     * @param {string} contentId - The ID of the content being processed for logging.
     * @returns {Promise<string>} The transcription in VTT format.
     */
    async transcribe(url, languageCode = 'en', contentId = 'N/A') {
        console.log(`[${contentId}] Transcription Service: Starting process for ${url} with target language ${languageCode}`);

        try {
            // Step 1: Define the base transcription payload.
            const data = {
                audio_url: url,
                language_detection: true, // Auto-detect source language.
            };

            // Speculatively add translation parameters if the target is not English.
            // The API will ignore this if the source and target languages match.
            if (languageCode && languageCode !== 'en') {
                console.log(`[${contentId}] Translation to '${languageCode}' requested. Adding translation parameters to single API call.`);
                data.speaker_labels = true; // Required for timestamped translation.
                data.speech_understanding = {
                    request: {
                        translation: {
                            target_languages: [languageCode],
                            match_original_utterance: true, // Get translated text per utterance.
                        },
                    },
                };
            }

            // Step 2: Submit the single transcription job.
            const submitResponse = await this.assembly.post('/transcript', data);
            const transcriptId = submitResponse.data.id;
            console.log(`[${contentId}] AssemblyAI transcription job submitted with ID: ${transcriptId}`);

            // Step 3: Poll for completion.
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

            // Step 4: Process the result.
            // Check if translation was performed and the result is available.
            if (transcriptData.utterances && transcriptData.utterances[0]?.translated_texts?.[languageCode]) {
                console.log(`[${contentId}] Reconstructing translated VTT for language '${languageCode}'.`);
                return reconstructVttFromUtterances(transcriptData.utterances, languageCode);
            } else {
                // If no translation was performed, fetch the original VTT.
                console.log(`[${contentId}] No translation performed or available. Fetching original source VTT.`);
                const vttResponse = await this.assembly.get(`/transcript/${transcriptId}/vtt`);
                return vttResponse.data;
            }

        } catch (error) {
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error(`[${contentId}] An error occurred in the AssemblyAI process:`, errorMessage);
            throw new Error(`Failed to process video: ${errorMessage}`);
        }
    }
}

module.exports = new TranscriptionService();