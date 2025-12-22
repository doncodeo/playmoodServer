const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const wavefile = require('wavefile');
const { pipeline, env } = require('@xenova/transformers');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
env.cacheDir = path.join(os.tmpdir(), 'transformers_cache');
console.log('Using transformers cache directory:', env.cacheDir);

function formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function toVtt(chunks) {
    let vtt = 'WEBVTT\n\n';
    if (!chunks) return vtt;

    chunks.forEach((chunk) => {
        if (chunk.timestamp && chunk.timestamp[0] != null && chunk.timestamp[1] != null) {
            const start = formatTimestamp(chunk.timestamp[0]);
            const end = formatTimestamp(chunk.timestamp[1]);
            vtt += `${start} --> ${end}\n`;
            vtt += `${chunk.text.trim()}\n\n`;
        }
    });
    return vtt;
}

const downloadProgress = {};

class TranscriptionService {
    constructor() {
        this.model = null;
        this.initializing = this.init();
    }

    async init() {
        // try {
        //     // Force-clear the cache to ensure the correct model revision is downloaded.
        //     if (fs.existsSync(env.cacheDir)) {
        //         console.log(`[Cache] Clearing transformers cache directory: ${env.cacheDir}`);
        //         fs.rmSync(env.cacheDir, { recursive: true, force: true });
        //         console.log('[Cache] Directory cleared successfully.');
        //     }
        // } catch (error) {
        //     console.error('[Cache] Error clearing transformers cache:', error);
        //     // Non-critical error, so we don't throw.
        // }

        try {
            this.model = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-base_timestamped', {
                quantized: true,
                revision: '85322b4',
                progress_callback: (progress) => {
                    if (progress.status === 'done') {
                        console.log(`[Model Loading] Download complete: ${progress.file}`);
                        delete downloadProgress[progress.file];
                        return;
                    }

                    if (progress.status === 'progress' && progress.total > 0) {
                        if (!downloadProgress[progress.file]) {
                            downloadProgress[progress.file] = {
                                lastLoggedPercentage: -1,
                                startTime: Date.now(),
                            };
                        }

                        const state = downloadProgress[progress.file];
                        const percentage = Math.floor((progress.loaded / progress.total) * 100);

                        if (percentage > state.lastLoggedPercentage) {
                            const elapsedTimeMs = Date.now() - state.startTime;
                            const downloadSpeedBps = progress.loaded / (elapsedTimeMs / 1000);
                            const remainingBytes = progress.total - progress.loaded;
                            const etaSeconds = Math.round(remainingBytes / downloadSpeedBps);

                            const loadedMB = Math.round(progress.loaded / 1024 / 1024);
                            const totalMB = Math.round(progress.total / 1024 / 1024);

                            console.log(`[Model Loading] Downloading ${progress.file}: ${percentage}% (${loadedMB}MB / ${totalMB}MB) - ETA: ${etaSeconds}s`);
                            state.lastLoggedPercentage = percentage;
                        }
                    } else if (progress.status === 'initiate') {
                         console.log(`[Model Loading] Initializing download for ${progress.file}`);
                    }
                },
            });
            console.log('Timestamped multilingual transcription model loaded successfully.');
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
        const audioPath = path.join(os.tmpdir(), `${Date.now()}.wav`);

        try {
            console.log(`[${contentId}] Transcription Service: Extracting audio.`);
            await this.extractAudio(videoPath, audioPath, contentId);
            console.log(`[${contentId}] Transcription Service: Audio extracted to ${audioPath}.`);

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
                language: language,
                task: task,
                return_timestamps: 'word',
            });

            const vttResult = toVtt(transcript.chunks);

            console.log(`[${contentId}] Transcription Service: Finished processing.`);
            return vttResult;
        } finally {
            console.log(`[${contentId}] Transcription Service: Cleaning up temporary files.`);
            await this.cleanup([videoPath, audioPath]);
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

        const videoPath = path.join(os.tmpdir(), `${Date.now()}.mp4`);
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

    async extractAudio(videoPath, outputPath, contentId = 'N-A') {
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .toFormat('wav')
                .audioChannels(1)
                .audioFrequency(16000)
                .on('error', (err) => {
                    console.error(`[${contentId}] Transcription Service: FFMpeg error during audio extraction.`, err);
                    reject(err);
                })
                .on('end', () => {
                    console.log(`[${contentId}] Transcription Service: Audio extraction complete.`);
                    resolve();
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
