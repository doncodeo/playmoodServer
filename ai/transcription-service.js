const axios = require('axios');

// A utility function to delay execution, used for polling.
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
     * Transcribes a video/audio file using the AssemblyAI API.
     * @param {string} url - The public URL of the video or audio file.
     * @param {string} languageCode - The language code for transcription (e.g., 'en', 'es').
     * @param {string} contentId - The ID of the content being processed, for logging.
     * @returns {Promise<string>} The transcription in VTT format.
     */
    async transcribe(url, languageCode = 'en', contentId = 'N/A') {
        console.log(`[${contentId}] Transcription Service: Starting process with AssemblyAI for ${url}`);

        try {
            // Step 1: Submit the transcription job to AssemblyAI
            const submitResponse = await this.assembly.post('/transcript', {
                audio_url: url,
                language_code: languageCode,
            });

            const transcriptId = submitResponse.data.id;
            console.log(`[${contentId}] AssemblyAI job submitted with ID: ${transcriptId}`);

            // Step 2: Poll for the transcription status
            while (true) {
                const pollResponse = await this.assembly.get(`/transcript/${transcriptId}`);
                const status = pollResponse.data.status;

                if (status === 'completed') {
                    console.log(`[${contentId}] Transcription complete for ID: ${transcriptId}`);
                    // Step 3: Fetch the VTT transcript
                    const vttResponse = await this.assembly.get(`/transcript/${transcriptId}/vtt`);
                    return vttResponse.data;
                } else if (status === 'error') {
                    const errorMessage = pollResponse.data.error || 'Unknown AssemblyAI error';
                    console.error(`[${contentId}] Transcription failed for ID: ${transcriptId}. Reason: ${errorMessage}`);
                    throw new Error(`AssemblyAI transcription failed: ${errorMessage}`);
                }

                console.log(`[${contentId}] Transcription status for ${transcriptId}: ${status}. Polling again in 10 seconds...`);
                await delay(10000); // Wait 10 seconds before the next poll
            }
        } catch (error) {
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error(`[${contentId}] An error occurred in the AssemblyAI transcription process:`, errorMessage);
            throw new Error(`Failed to transcribe video: ${errorMessage}`);
        }
    }
}

module.exports = new TranscriptionService();
