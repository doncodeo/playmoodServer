const mongoose = require('mongoose');

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
        credit: {
            type: String,
            required: true,
        },
        video: {
            type: String,
            required: true,
        },
        cloudinary_video_id: {
            type: String,
        },
        cloudinary_thumbnail_id: {
            type: String,
        },
        isApproved: {
            type: Boolean,
            default: false,
        },
        rejectionReason: {
            type: String,
            trim: true,
            maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
        },
        views: {
            type: Number,
            default: 0,
        },
        viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'profiles' }],
        viewerIPs: [{ type: String }],
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

module.exports = mongoose.model('Contents', contentSchema);