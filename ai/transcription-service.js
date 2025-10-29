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
            this.model = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
            console.log('Transcription model loaded successfully.');
        } catch (error) {
            console.error('Error loading transcription model:', error);
            throw error;
        }
    }

    async transcribe(url, language = 'eng_Latn') {
        await this.initializing;
        if (!this.model) {
            throw new Error('Transcription model failed to load.');
        }

        const videoPath = await this.download(url);
        const audioPath = await this.extractAudio(videoPath);

        try {
            // Read the audio file and convert it to the format required by the model
            const buffer = fs.readFileSync(audioPath);
            const wav = new wavefile.WaveFile(buffer);
            wav.toBitDepth('32f');
            wav.toSampleRate(16000);
            let audioData = wav.getSamples();
            if (Array.isArray(audioData)) {
                // For multi-channel audio, take the first channel
                audioData = audioData[0];
            }

            const transcript = await this.model(audioData, {
                chunk_length_s: 30,
                stride_length_s: 5,
                language: language,
                task: 'transcribe',
            });

            return transcript.text;
        } finally {
            await this.cleanup([videoPath, audioPath]);
        }
    }

    async download(url) {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
        });

        const videoPath = path.join('/tmp', `${Date.now()}.mp4`);
        const writer = fs.createWriteStream(videoPath);

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(videoPath));
            writer.on('error', reject);
        });
    }

    async extractAudio(videoPath) {
        const audioPath = videoPath.replace('.mp4', '.wav');

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .toFormat('wav')
                .audioChannels(1) // Mono channel
                .audioFrequency(16000) // 16000Hz sample rate
                .on('error', reject)
                .on('end', () => resolve(audioPath))
                .save(audioPath);
        });
    }

    async cleanup(files) {
        for (const file of files) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        }
    }
}

module.exports = new TranscriptionService();