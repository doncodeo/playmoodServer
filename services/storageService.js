const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
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
        // By default, AWS SDK signs 'host' and 'content-type' if provided in the command.
        // We must ensure the client sends EXACTLY the same content-type.
        const url = await getSignedUrl(r2Client, command, {
            expiresIn: 3600,
            // We explicitly specify which headers to sign to avoid surprises from SDK middleware
            signableHeaders: new Set(['host', 'content-type']),
            // Ensure parameters stay in query string
            unhoistableHeaders: new Set(['x-amz-content-sha256', 'x-amz-user-agent']),
        });

        return { url, key };
    }

    /**
     * Upload a buffer or stream to R2 (used for processed assets)
     */
    async uploadToR2(fileBuffer, fileName, contentType, namespace = this.namespaces.VIDEOS) {
        const key = `${namespace}/${fileName}`;
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: contentType,
        });

        await r2Client.send(command);
        return {
            key,
            url: this.getR2PublicUrl(key)
        };
    }

    /**
     * Download a file from R2 to a local path
     */
    async downloadFromR2(key, localPath) {
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
