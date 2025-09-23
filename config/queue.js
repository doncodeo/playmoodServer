const { Queue } = require('bullmq');

// The REDIS_URL will be provided by the Heroku Redis add-on in production.
// For local development, it will fall back to a standard local Redis instance.
const redisConnection = {
  connection: {
    url: process.env.REDIS_URL,
    tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  },
};

const uploadQueue = new Queue('upload', redisConnection);

module.exports = uploadQueue;
