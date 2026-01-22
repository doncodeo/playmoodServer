const { S3Client } = require('@aws-sdk/client-s3');

/**
 * Cloudflare R2 Client Configuration
 * R2 is S3-compatible, so we use the AWS SDK S3 client.
 */
const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

module.exports = {
    r2Client,
    bucketName: process.env.R2_BUCKET_NAME,
    publicDomain: process.env.R2_PUBLIC_DOMAIN, // e.g., assets.playmood.tv or the R2.dev URL
};
