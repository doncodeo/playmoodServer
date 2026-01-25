const { S3Client } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');

/**
 * Cloudflare R2 Client Configuration
 */
const requiredVars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
requiredVars.forEach(v => {
    if (!process.env[v]) console.error(`[R2 Config] WARN: ${v} is missing from environment variables.`);
});

const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    // For R2 streaming uploads, we disable internal retries (maxAttempts: 1)
    // and use our manual retry logic in StorageService that recreates the stream.
    maxAttempts: 1,
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 300000, // 300 seconds
        socketTimeout: 300000,
    }),
    // R2 doesn't support all S3 features like checksums in the same way,
    // so we use a more compatible configuration for presigning.
    forcePathStyle: false,
    // Explicitly disable automatic checksum calculation which can break signatures in Postman/R2
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
});

module.exports = {
    r2Client,
    bucketName: process.env.R2_BUCKET_NAME,
    publicDomain: process.env.R2_PUBLIC_DOMAIN, // e.g., assets.playmood.tv or the R2.dev URL
};
