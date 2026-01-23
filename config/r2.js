const { S3Client } = require('@aws-sdk/client-s3');

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
    // R2 doesn't support all S3 features like checksums in the same way,
    // so we use a more compatible configuration for presigning.
    forcePathStyle: false,
});

module.exports = {
    r2Client,
    bucketName: process.env.R2_BUCKET_NAME,
    publicDomain: process.env.R2_PUBLIC_DOMAIN, // e.g., assets.playmood.tv or the R2.dev URL
};
