const mongoose = require('mongoose');

const feedPostViewSchema = new mongoose.Schema(
    {
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FeedPost',
            required: true,
            index: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'profiles',
            index: true,
        },
        ip: {
            type: String,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index to quickly check for existing views
feedPostViewSchema.index({ post: 1, user: 1 }, { unique: true, sparse: true });
feedPostViewSchema.index({ post: 1, ip: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('FeedPostView', feedPostViewSchema);
