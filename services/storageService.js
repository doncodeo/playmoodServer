const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { r2Client, bucketName, publicDomain } = require('../config/r2');
const cloudinary = require('../config/cloudinary');
const crypto = require('crypto');
const fs = require('fs');

class StorageService {
    constructor() {
        this.providers = {
            R2: 'r2',
            CLOUDINARY: 'cloudinary'
        };

        this.namespaces = {
            RAW: 'raw',
            VIDEOS: 'processed/videos',
            THUMBNAILS: 'processed/thumbnails',
            HIGHLIGHTS: 'processed/highlights',
            AUDIO: 'processed/audio'
        };
    }

    /**
     * Generate a unique filename
     */
    generateFileName(originalName, prefix = '') {
        const timestamp = Date.now();
        const hash = crypto.randomBytes(4).toString('hex');
        const ext = originalName.split('.').pop();
        return `${prefix}${timestamp}-${hash}.${ext}`;
    }

    /**
     * Get a presigned URL for direct upload to R2
     */
    async getPresignedUploadUrl(fileName, contentType, namespace = this.namespaces.RAW) {
        // Avoid double namespace if fileName already starts with it
        const key = fileName.startsWith(`${namespace}/`) ? fileName : `${namespace}/${fileName}`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: contentType,
        });

        // R2 is very sensitive to signed headers.
        // We ensure only the absolute minimum headers are signed to avoid mismatches.
        // "No date provided" error in Postman is usually caused by an 'Authorization' header
        // being present in the request, which forces the server to ignore query string auth.
        const url = await getSignedUrl(r2Client, command, {
            expiresIn: 3600,
            signableHeaders: new Set(['host', 'content-type']),
        });

        return { url, key };
    }

    /**
     * Upload a buffer or stream to R2 (used for processed assets)
     * Includes manual retry logic for streams to avoid "non-retryable streaming request" errors.
     */
    async uploadToR2(body, fileName, contentType, namespace = this.namespaces.VIDEOS) {
        const key = `${namespace}/${fileName}`;

        const performUpload = async (currentBody) => {
            const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: currentBody,
                ContentType: contentType,
            });
            return await r2Client.send(command);
        };

        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // For the first attempt, use the provided body
                // For subsequent attempts, if it's a stream, we MUST recreate it
                let bodyToUse = body;
                if (attempt > 1 && body instanceof fs.ReadStream && body.path) {
                    bodyToUse = fs.createReadStream(body.path);
                }

                await performUpload(bodyToUse);
                return {
                    key,
                    url: this.getR2PublicUrl(key)
                };
            } catch (error) {
                lastError = error;
                const transientCodes = ['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT'];
                const isTransient =
                    error.$metadata?.httpStatusCode >= 500 ||
                    error.name === 'TimeoutError' ||
                    transientCodes.includes(error.code);

                console.error(`[StorageService] Upload attempt ${attempt} failed for ${key} (${error.code || error.name}):`, error.message);

                if (!isTransient || attempt === 3) break;

                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        throw lastError;
    }

    /**
     * Download a file from R2 to a local path with retry logic
     */
    async downloadFromR2(key, localPath) {
        const performDownload = async () => {
            const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: key,
            });

            const response = await r2Client.send(command);
            const writer = fs.createWriteStream(localPath);

            return new Promise((resolve, reject) => {
                response.Body.on('error', reject);
                response.Body.pipe(writer);
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        };

        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await performDownload();
            } catch (error) {
                lastError = error;
                const transientCodes = ['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT'];
                const isTransient =
                    error.$metadata?.httpStatusCode >= 500 ||
                    error.name === 'TimeoutError' ||
                    error.name === 'NetworkingError' ||
                    transientCodes.includes(error.code);

                console.error(`[StorageService] Download attempt ${attempt} failed for ${key} (${error.code || error.name}):`, error.message);

                if (!isTransient || attempt === 3) break;

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        throw lastError;
    }

    /**
     * Check if an object exists in R2
     */
    async checkFileExists(key) {
        try {
            const command = new HeadObjectCommand({
                Bucket: bucketName,
                Key: key,
            });
            await r2Client.send(command);
            return true;
        } catch (error) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Delete an object from storage
     */
    async delete(key, provider = this.providers.R2) {
        if (provider === this.providers.CLOUDINARY) {
            return await cloudinary.uploader.destroy(key);
        }

        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        return await r2Client.send(command);
    }

    /**
     * Get public URL for R2 asset
     */
    getR2PublicUrl(key) {
        if (!key) return null;
        if (!publicDomain) {
            console.error('[StorageService] publicDomain is not configured. Check R2_PUBLIC_DOMAIN env var.');
            return null;
        }
        // Ensure publicDomain doesn't have a trailing slash
        const domain = publicDomain.replace(/\/$/, '');
        return `${domain}/${key}`;
    }

    /**
     * Get public URL for Cloudinary asset
     */
    getCloudinaryUrl(publicId, resourceType = 'video') {
        if (!publicId) return null;
        return cloudinary.url(publicId, {
            resource_type: resourceType,
            secure: true
        });
    }

    /**
     * Unified method to get URL based on provider
     */
    getUrl(key, provider = this.providers.R2, resourceType = 'video') {
        if (provider === this.providers.CLOUDINARY) {
            return this.getCloudinaryUrl(key, resourceType);
        }
        return this.getR2PublicUrl(key);
    }
}

module.exports = new StorageService();
