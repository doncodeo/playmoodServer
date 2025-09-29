const { Queue } = require('bullmq');

let uploadQueue;

if (process.env.NODE_ENV === 'test') {
  // For tests, use a mock queue that doesn't connect to Redis.
  uploadQueue = {
    add: async (name, data) => {
      // This is a mock implementation. In tests, it will be stubbed by Sinon.
    },
    // Add other methods that might be called if necessary.
  };
} else {
  // In production and development, connect to Redis.
  const redisConnection = {
      url: process.env.REDIS_URL,
      tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  };
  uploadQueue = new Queue('upload', { connection: redisConnection });
}

module.exports = uploadQueue;
