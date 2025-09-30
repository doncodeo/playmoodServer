const { startWorker, gracefulShutdown } = require('./worker-manager');
const connectDB = require('./config/db');
const dotenv = require('dotenv');

dotenv.config();

const start = async () => {
    try {
        await connectDB();
        console.log('[Worker] MongoDB connected for standalone worker.');
        startWorker();
    } catch (error) {
        console.error('[Worker] Failed to start standalone worker:', error);
        process.exit(1);
    }
};

// Start the worker process
start();

// Handle graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);