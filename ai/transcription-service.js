const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const wavefile = require('wavefile');
const { pipeline, env } = require('@xenova/transformers');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
env.cacheDir = '/tmp/transformers_cache';
console.log('Using transformers cache directory:', env.cacheDir);

class TranscriptionService {
    constructor() {
        this.model = null;
        this.initializing = this.init();
    }

    async init() {
        try {
            this.model = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', { quantized: true });
            console.log('Quantized multilingual transcription model loaded successfully.');
        } catch (error) {
            console.error('Error loading transcription model:', error);
            throw error;
        }
    }

    async transcribe(url, language = 'eng_Latn', contentId = 'N/A') {
        await this.initializing;
        if (!this.model) {
            throw new Error('Transcription model failed to load.');
        }

        console.log(`[${contentId}] Transcription Service: Starting process.`);
        const videoPath = await this.download(url, contentId);
        const tempAudioDir = path.join('/tmp', `chunks_${Date.now()}`);
        fs.mkdirSync(tempAudioDir, { recursive: true });

        try {
            console.log(`[${contentId}] Transcription Service: Extracting audio chunks.`);
            const chunkFiles = await this.extractAudioChunks(videoPath, tempAudioDir, contentId);
            console.log(`[${contentId}] Transcription Service: Found ${chunkFiles.length} audio chunks.`);
            let fullTranscript = '';
            let chunkCounter = 0;

            for (const audioPath of chunkFiles.sort()) {
                chunkCounter++;
                console.log(`[${contentId}] Transcription Service: Processing chunk ${chunkCounter} of ${chunkFiles.length}.`);
                const buffer = fs.readFileSync(audioPath);
                const wav = new wavefile.WaveFile(buffer);
                wav.toBitDepth('32f');
                wav.toSampleRate(16000);
                let audioData = wav.getSamples();
                if (Array.isArray(audioData)) {
                    audioData = audioData[0];
                }

                const task = language === 'en' ? 'translate' : 'transcribe';
                console.log(`[${contentId}] Transcription Service: Using task '${task}' for language '${language}'.`);

                const transcript = await this.model(audioData, {
                    chunk_length_s: 30,
                    stride_length_s: 5,
                    language: language,
                    task: task,
                });

                if (transcript && transcript.text) {
                    fullTranscript += transcript.text.trim() + ' ';
                }
            }
            console.log(`[${contentId}] Transcription Service: Finished processing all chunks.`);
            return fullTranscript.trim();
        } finally {
            console.log(`[${contentId}] Transcription Service: Cleaning up temporary files.`);
            await this.cleanup([videoPath], [tempAudioDir]);
            console.log(`[${contentId}] Transcription Service: Cleanup complete.`);
        }
    }

    async download(url, contentId = 'N/A') {
        console.log(`[${contentId}] Transcription Service: Downloading video from ${url}.`);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
        });

        const videoPath = path.join('/tmp', `${Date.now()}.mp4`);
        const writer = fs.createWriteStream(videoPath);

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`[${contentId}] Transcription Service: Video downloaded successfully to ${videoPath}.`);
                resolve(videoPath);
            });
            writer.on('error', (error) => {
                console.error(`[${contentId}] Transcription Service: Error downloading video.`, error);
                reject(error);
            });
        });
    }

    async extractAudioChunks(videoPath, outputDir, contentId = 'N/A') {
        const outputPath = path.join(outputDir, 'chunk_%03d.wav');

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .toFormat('wav')
                .audioChannels(1)
                .audioFrequency(16000)
                .outputOptions([
                    '-f segment',
                    '-segment_time 30',
                    '-c:a pcm_s16le',
                ])
                .on('error', (err) => {
                    console.error(`[${contentId}] Transcription Service: FFMpeg error during audio extraction.`, err);
                    reject(err);
                })
                .on('end', () => {
                    console.log(`[${contentId}] Transcription Service: Audio extraction complete.`);
                    const chunks = fs.readdirSync(outputDir).map(file => path.join(outputDir, file));
                    resolve(chunks);
                })
                .save(outputPath);
        });
    }

    async cleanup(files, dirs = []) {
        for (const file of files) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        }
        for (const dir of dirs) {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        }
    }
}

module.exports = new TranscriptionService();