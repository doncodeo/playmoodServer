const mongoose = require('mongoose');

const feedPostSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'profiles',
            required: true,
        },
        caption: {
            type: String,
            trim: true,
            maxlength: [2200, 'Caption cannot exceed 2200 characters'],
        },
        type: {
            type: String,
            enum: ['image', 'video'],
            required: true,
        },
        media: [
            {
                url: {
                    type: String,
                    required: true,
                },
                public_id: {
                    type: String,
                    required: true,
                },
            },
        ],
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
        viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'profiles' }],
        viewerIPs: [{ type: String }],
    },
    {
        timestamps: true,
    }
);

// Virtual for views count
feedPostSchema.virtual('viewsCount').get(function () {
    // Combine unique user IDs and IP addresses for a more accurate count
    const uniqueViewers = new Set(this.viewers.map(id => id.toString()));
    this.viewerIPs.forEach(ip => uniqueViewers.add(ip));
    return uniqueViewers.size;
});

// Virtual for likes count
feedPostSchema.virtual('likesCount').get(function () {
    return this.likes ? this.likes.length : 0;
});

// Virtual for comments count
feedPostSchema.virtual('commentsCount').get(function () {
    return this.comments ? this.comments.length : 0;
});

// Ensure virtual fields are included in toJSON output
feedPostSchema.set('toJSON', { virtuals: true, getters: true });
feedPostSchema.set('toObject', { virtuals: true, getters: true });

module.exports = mongoose.model('FeedPost', feedPostSchema);
