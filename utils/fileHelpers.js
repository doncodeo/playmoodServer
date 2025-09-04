const fs = require('fs');
const fsp = require('fs').promises;
const axios = require('axios');
const path = require('path');

function cleanupFiles(files) {
    if (!files) return;
    (Array.isArray(files) ? files : [files]).forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) { console.error("Error cleaning up file:", e); }
    });
}

/**
 * Downloads a file from a URL to a specified destination.
 * @param {string} url The URL of the file to download.
 * @param {string} destination The local path to save the file to.
 * @returns {Promise<void>}
 */
async function downloadFile(url, destination) {
    const writer = fs.createWriteStream(destination);

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

module.exports = { cleanupFiles, downloadFile };