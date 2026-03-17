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

        const posts = await FeedPost.find({});
        console.log(`Checking ${posts.length} total feed posts...`);

        let fixCount = 0;
        for (const post of posts) {
            let needsFix = false;
            for (const item of post.media) {
                const url = item.url || '';
                const key = item.key || '';
                // Robust video detection: matches common video extensions with or without query params
                const isVideo = url.match(/\.(mp4|mov|avi|wmv|flv|mkv|webm)(\?.*)?$/i) || key.match(/\.(mp4|mov|avi|wmv|flv|mkv|webm)$/i);
                const missingThumb = !item.thumbnail || !item.thumbnail.url;

                // Also check for R2 URLs that might be labeled as Cloudinary
                const isR2Url = url.includes('r2.dev') || url.includes('r2.playmoodtv.com');

                if (isVideo && missingThumb) {
                    needsFix = true;
                    break;
                }

                if (isVideo && isR2Url && item.provider !== 'r2') {
                    needsFix = true;
                    break;
                }
            }

            if (needsFix) {
                console.log(`Queueing job for post ID: ${post._id}`);
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
                fixCount++;
            }
        }

        console.log(`Successfully queued ${fixCount} posts for thumbnail generation.`);

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
