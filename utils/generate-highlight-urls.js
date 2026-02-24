const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const contentSchema = require('../models/contentModel');
const Highlight = require('../models/highlightModel');
const storageService = require('../services/storageService');

const generateHighlightUrls = async () => {
    try {
        await connectDB();

        console.log('Fetching all highlights...');
        const highlights = await Highlight.find({});
        console.log(`Found ${highlights.length} highlights to check.`);

        for (const highlight of highlights) {
            let url = null;
            if (highlight.storageProvider === 'r2' && highlight.storageKey) {
                url = storageService.getR2PublicUrl(highlight.storageKey);
            } else if (highlight.storageProvider === 'cloudinary') {
                // We need the content's cloudinary_video_id to reconstruct the URL
                const content = await contentSchema.findById(highlight.content);
                if (content && content.cloudinary_video_id) {
                    url = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/e_accelerate:50,so_${highlight.startTime},eo_${highlight.endTime}/${content.cloudinary_video_id}.mp4`;
                }
            }

            if (url) {
                // We use findByIdAndUpdate to bypass validation if necessary, but here we just want to set the field
                await Highlight.findByIdAndUpdate(highlight._id, { highlightUrl: url });
                console.log(`Updated URL for highlight ${highlight._id}`);
            }
        }

        console.log('Fetching all content with highlights...');
        const contents = await contentSchema.find({ highlights: { $exists: true, $not: { $size: 0 } } });
        console.log(`Found ${contents.length} content items to check.`);

        for (const content of contents) {
            // Get the latest highlight
            const lastHighlightId = content.highlights[content.highlights.length - 1];
            const lastHighlight = await Highlight.findById(lastHighlightId);

            if (lastHighlight && lastHighlight.highlightUrl) {
                await contentSchema.findByIdAndUpdate(content._id, { highlightUrl: lastHighlight.highlightUrl });
                console.log(`Updated highlightUrl for content: ${content.title} (${content._id})`);
            }
        }

        console.log('Finished highlight URL migration.');
        setTimeout(() => process.exit(0), 2000);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

generateHighlightUrls();
