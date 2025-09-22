const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function compressVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      try {
        fs.mkdirSync(outputDir, { recursive: true });
      } catch (err) {
        return reject(new Error(`Failed to create output directory: ${err.message}`));
      }
    }

    const ffmpegArgs = [
      '-i',
      inputPath,
      '-c:v',
      'libx264', // Video codec: H.264
      '-preset',
      'medium', // Encoding speed/quality trade-off
      '-crf',
      '23', // Constant Rate Factor (lower value = higher quality)
      '-c:a',
      'aac', // Audio codec: AAC
      '-b:a',
      '128k', // Audio bitrate
      outputPath,
    ];

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    let stderrOutput = '';
    ffmpegProcess.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Compression finished successfully: ${outputPath}`);
        resolve(outputPath);
      } else {
        console.error(`ffmpeg exited with code ${code}`);
        console.error(`ffmpeg stderr:\n${stderrOutput}`);
        fs.unlink(outputPath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.error(`Error deleting incomplete output file: ${err.message}`);
          }
        });
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpegProcess.on('error', (err) => {
      console.error('Failed to start ffmpeg process:', err);
      reject(err);
    });
  });
}

module.exports = {
  compressVideo,
};
