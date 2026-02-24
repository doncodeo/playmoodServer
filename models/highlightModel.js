const mongoose = require('mongoose');

// Helper function to enforce HTTPS on URLs
const enforceHttps = (url) => {
    if (typeof url === 'string') {
        return url.replace(/^http:\/\//i, 'https://');
    }
    return url;
};

const highlightSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'profiles',
            required: true,
        },
        content: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contents',
            required: true,
        },
        title: {
            type: String,
        },
        startTime: {
            type: Number,
            required: true,
        },
        endTime: {
            type: Number,
            required: true,
        },
        storageProvider: {
            type: String,
            enum: ['cloudinary', 'r2'],
            default: 'cloudinary'
        },
        storageKey: {
            type: String,
        },
        highlightUrl: {
            type: String,
            get: enforceHttps,
        },
    },
    {
        timestamps: true,
    }
);

// Ensure virtual fields are included in toJSON output
highlightSchema.set('toJSON', { getters: true });
highlightSchema.set('toObject', { getters: true });

module.exports = mongoose.model('Highlights', highlightSchema);
