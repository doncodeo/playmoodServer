const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'profiles',
            required: [true, 'Playlist must belong to a user'],
        },
        name: {
            type: String,
            required: [true, 'Playlist name is required'],
            trim: true,
            maxlength: [100, 'Playlist name cannot exceed 100 characters'],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters'],
        },
        videos: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Contents',
                validate: {
                    validator: mongoose.Types.ObjectId.isValid,
                    message: 'Invalid content ID in playlist',
                },
            },
        ],
        visibility: {
            type: String,
            enum: ['public', 'private', 'unlisted'],
            default: 'public',
        },
        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'profiles',
                validate: {
                    validator: mongoose.Types.ObjectId.isValid,
                    message: 'Invalid user ID in likes',
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Prevent duplicate videos in playlist
playlistSchema.pre('save', function (next) {
    this.videos = [...new Set(this.videos.map(String))].map(mongoose.Types.ObjectId);
    this.likes = [...new Set(this.likes.map(String))].map(mongoose.Types.ObjectId);
    next();
});

// Validate videos are approved
playlistSchema.pre('save', async function (next) {
    const Content = mongoose.model('Contents');
    const invalidVideos = [];
    for (const videoId of this.videos) {
        const content = await Content.findById(videoId);
        if (!content || !content.isApproved) {
            invalidVideos.push(videoId);
        }
    }
    if (invalidVideos.length > 0) {
        return next(new Error(`Invalid or unapproved videos: ${invalidVideos.join(', ')}`));
    }
    next();
});

module.exports = mongoose.model('Playlist', playlistSchema);