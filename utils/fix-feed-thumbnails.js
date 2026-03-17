const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const FeedPost = require('../models/feedPostModel');
const uploadQueue = require('../config/queue');

const fixThumbnails = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('MONGO_URI is not defined in environment variables.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const postsToFix = await FeedPost.find({
            'media': {
                $elemMatch: {
                    provider: 'r2',
                    $or: [
                        { 'thumbnail.url': { $exists: false } },
                        { 'thumbnail.url': null },
                        { 'thumbnail.url': '' }
                    ],
                    // Basic regex for video extensions in URL or key
                    $or: [
                        { url: /\.(mp4|mov|avi|wmv|flv|mkv|webm)$/i },
                        { key: /\.(mp4|mov|avi|wmv|flv|mkv|webm)$/i }
                    ]
                }
            }
        });

        console.log(`Found ${postsToFix.length} video posts needing thumbnail fixes.`);

        for (const post of postsToFix) {
            console.log(`Queueing job for post ID: ${post._id}`);

            // Set status to processing so it's clear it's being worked on
            post.status = 'processing';
            await post.save();

            await uploadQueue.add('process-feed-post', {
                postId: post._id,
            }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: true,
            });
        }

        console.log('All applicable posts have been queued for processing.');

        // Give it a moment before closing
        setTimeout(() => {
            mongoose.disconnect();
            console.log('Disconnected from MongoDB');
            process.exit(0);
        }, 2000);

    } catch (error) {
        console.error('Error fixing thumbnails:', error);
        process.exit(1);
    }
};

fixThumbnails();
