const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const { startWorker, gracefulShutdown } = require('./worker-manager');

// MongoDB Connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
        });
        console.log(`[Worker] MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[Worker] MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

connectDB().then(() => {
    console.log('[Worker] Starting worker process...');
    startWorker();
});

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
