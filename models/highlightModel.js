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
            required: false, // Now optional for standalone highlights
        },
        title: {
            type: String,
            required: true,
        },
        startTime: {
            type: Number,
            required: false, // Optional for standalone highlights
        },
        endTime: {
            type: Number,
            required: false, // Optional for standalone highlights
        },
        storageProvider: {
            type: String,
            enum: ['cloudinary', 'r2'],
            default: 'r2',
        },
        storageKey: {
            type: String,
        },
        videoKey: {
            type: String,
        },
        highlightUrl: {
            type: String,
            get: enforceHttps,
        },
        thumbnail: {
            type: String,
            get: enforceHttps,
        },
        thumbnailKey: {
            type: String,
        },
        duration: {
            type: Number,
        },
        status: {
            type: String,
            enum: ['processing', 'completed', 'failed'],
            default: 'completed',
        },
        isApproved: {
            type: Boolean,
            default: false,
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
