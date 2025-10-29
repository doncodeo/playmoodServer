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
        const tempAudioDir = path.join('/tmp', `chunks_${Date.now()}`);
        fs.mkdirSync(tempAudioDir, { recursive: true });

        try {
            const chunkFiles = await this.extractAudioChunks(videoPath, tempAudioDir);
            let fullTranscript = '';

            for (const audioPath of chunkFiles.sort()) {
                const buffer = fs.readFileSync(audioPath);
                const wav = new wavefile.WaveFile(buffer);
                wav.toBitDepth('32f');
                wav.toSampleRate(16000);
                let audioData = wav.getSamples();
                if (Array.isArray(audioData)) {
                    audioData = audioData[0];
                }

                const transcript = await this.model(audioData, {
                    chunk_length_s: 30,
                    stride_length_s: 5,
                    language: language,
                    task: 'transcribe',
                });

                if (transcript && transcript.text) {
                    fullTranscript += transcript.text.trim() + ' ';
                }
            }
            return fullTranscript.trim();
        } finally {
            await this.cleanup([videoPath], [tempAudioDir]);
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

    async extractAudioChunks(videoPath, outputDir) {
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
                .on('error', reject)
                .on('end', () => {
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