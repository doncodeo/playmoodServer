const mongoose = require('mongoose');

// Helper function to enforce HTTPS on URLs
const enforceHttps = (url) => {
    if (typeof url === 'string') {
        return url.replace(/^http:\/\//i, 'https://');
    }
    return url;
};

const contentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'profiles',
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        thumbnail: {
            type: String,
            get: enforceHttps,
        },
        shortPreview: {
            type: {
                start: { type: Number, required: true }, // Start time in seconds
                end: { type: Number, required: true }, // End time in seconds
            },
            validate: {
                validator: function (preview) {
                    return preview.end - preview.start === 10; // Ensure exactly 10 seconds
                },
                message: 'Preview segment must be exactly 10 seconds.',
            },
        },
        shortPreviewUrl: {
            type: String,
            get: enforceHttps,
        },
        shortPreviewKey: String,
        highlightUrl: {
            type: String,
            get: enforceHttps,
        },
        credit: {
            type: String,
            required: true,
        },
        video: {
            type: String,
            required: true,
            get: enforceHttps,
        },
        videoKey: String,
        duration: {
            type: Number,
        },
        storageProvider: {
            type: String,
            enum: ['cloudinary', 'r2'],
            default: 'cloudinary'
        },
        processingStatus: {
            type: String,
            enum: ['pending', 'processing', 'ready', 'failed'],
            default: 'ready'
        },
        cloudinary_video_id: {
            type: String,
        },
        cloudinary_thumbnail_id: {
            type: String,
        },
        thumbnailKey: String,
        highlightKey: String,
        audioKey: String,
        isApproved: {
            type: Boolean,
            default: false,
        },
        rejectionReason: {
            type: String,
            trim: true,
            maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
        },
        status: {
            type: String,
            enum: ['processing', 'processed', 'completed', 'failed'],
            default: 'processing',
        },
        captions: [
            {
                languageCode: {
                    type: String,
                    required: true,
                },
                text: {
                    type: String,
                    required: true,
                },
            },
        ],
        contentEmbedding: {
            type: [Number],
        },
        aiModerationStatus: {
            type: String,
            enum: ['approved', 'rejected', 'needs_review', 'pending', 'processing', 'failed'],
            default: 'pending',
        },
        aiModerationLabels: {
            type: [String],
        },
        translatedVideos: [{
            language: String,
            url: String,
            videoTranslateId: String,
            status: {
                type: String,
                enum: ['pending', 'running', 'success', 'failed'],
                default: 'pending'
            },
            eta: {
                type: Number, // Estimated completion time in seconds
            },
            cloudinary_video_id: String,
            storageKey: String,
            storageProvider: {
                type: String,
                enum: ['cloudinary', 'r2'],
                default: 'cloudinary'
            },
        }],
        views: {
            type: Number,
            default: 0,
        },
        viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'profiles' }],
        viewerIPs: [{ type: String }],
        shortPreviewViews: {
            type: Number,
            default: 0,
        },
        shortPreviewViewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'profiles' }],
        shortPreviewViewerIPs: [{ type: String }],
        highlights: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Highlights',
        }],
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'profiles' }],
        comments: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'profiles',
                    required: true,
                },
                text: {
                    type: String,
                    required: true,
                    trim: true,
                    maxlength: [1000, 'Comment cannot exceed 1000 characters'],
                },
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Clear rejectionReason when approving content
contentSchema.pre('save', function (next) {
    if (this.isApproved) {
        this.rejectionReason = undefined;
    }
    next();
});

// Virtual for likes count
contentSchema.virtual('likesCount').get(function () {
    return this.likes ? this.likes.length : 0;
});

// Virtual for comments count
contentSchema.virtual('commentsCount').get(function () {
    return this.comments ? this.comments.length : 0;
});

// Ensure virtual fields are included in toJSON output
contentSchema.set('toJSON', { virtuals: true, getters: true });
contentSchema.set('toObject', { virtuals: true, getters: true });

module.exports = mongoose.model('Contents', contentSchema);