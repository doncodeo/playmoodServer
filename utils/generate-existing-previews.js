const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const contentSchema = require('../models/contentModel');
const uploadQueue = require('../config/queue');

const generateExistingPreviews = async () => {
    try {
        await connectDB();

        console.log('Searching for R2 content missing short preview URLs...');

        const contents = await contentSchema.find({
            storageProvider: 'r2',
            shortPreview: { $ne: null },
            $or: [
                { shortPreviewUrl: { $exists: false } },
                { shortPreviewUrl: null },
                { shortPreviewUrl: "" }
            ]
        });

        console.log(`Found ${contents.length} videos to process.`);

        for (const content of contents) {
            console.log(`Queueing short preview generation for: ${content.title} (${content._id})`);
            await uploadQueue.add('generate-short-preview', {
                contentId: content._id
            });
        }

        console.log('Finished queueing all jobs.');
        // Wait a bit for jobs to be sent to Redis
        setTimeout(() => process.exit(0), 2000);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

generateExistingPreviews();
