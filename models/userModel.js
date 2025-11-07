const mongoose = require('mongoose');

// Helper function to enforce HTTPS on URLs
const enforceHttps = (url) => {
    if (typeof url === 'string') {
        return url.replace(/^http:\/\//i, 'https://');
    }
    return url;
};

const userRoles = ['user', 'creator', 'admin'];

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please enter your full name'],
        },
        userName: {
            type: String,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true
        },
        email: {
            type: String,
            required: [true, 'Please enter your email'],
            unique: true,
        },
        password: {
            type: String,
        },
        googleId: {
            type: String,
        },
        role: {
            type: String,
            enum: userRoles,
            default: 'user',
        },
        profileImage: {
            type: String,
            get: enforceHttps,
        },
        cloudinary_id: {
            type: String,
        },
        country: {
            type: String,
        },
        emailVerificationCode: {
            type: String,
        },
        emailVerificationExpires: {
            type: Date,
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Contents',
                validate: {
                    validator: mongoose.Types.ObjectId.isValid,
                    message: 'Invalid content ID in likes',
                },
            },
        ],
        watchlist: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Contents',
                validate: {
                    validator: mongoose.Types.ObjectId.isValid,
                    message: 'Invalid content ID in watchlist',
                },
            },
        ],
        history: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Contents',
                validate: {
                    validator: mongoose.Types.ObjectId.isValid,
                    message: 'Invalid content ID in history',
                },
            },
        ],
        hasReadPrivacyPolicy: {
            type: Boolean,
            default: false,
        },
        subscriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'profiles' }],
        subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'profiles' }],
        about: {
            type: String,
            default: 'This is my channel!',
        },
        bannerImage: {
            type: String,
            default: 'https://img.freepik.com/free-vector/gradient-colored-youtube-banner_23-2149209334.jpg',
            get: enforceHttps,
        },
        bannerImageId: {
            type: String,
        },
        communityPosts: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'CommunityPost',
            },
        ],
        playlists: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Playlist',
                validate: {
                    validator: mongoose.Types.ObjectId.isValid,
                    message: 'Invalid playlist ID',
                },
            },
        ],
        videoProgress: [
            {
                contentId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Contents',
                    validate: {
                        validator: mongoose.Types.ObjectId.isValid,
                        message: 'Invalid content ID in videoProgress',
                    },
                },
                progress: { type: Number, default: 0 },
            },
        ],
        instagram: {
            type: String,
            default: '',
            trim: true,
        },
        tiktok: {
            type: String,
            default: '',
            trim: true,
        },
        linkedin: {
            type: String,
            default: '',
            trim: true,
        },
        twitter: {
            type: String,
            default: '',
            trim: true,
        },
        creatorApplicationStatus: {
            type: String,
            enum: ['none', 'pending', 'approved', 'rejected'],
            default: 'none',
        },
        feedSettings: {
            feedPosts: { type: Boolean, default: true },
            thumbnails: { type: Boolean, default: true },
            shortPreviews: { type: Boolean, default: true },
            highlights: { type: Boolean, default: true },
        },
    },
    {
        timestamps: true,
        toJSON: { getters: true },
        toObject: { getters: true },
    }
);

module.exports = mongoose.model('profiles', userSchema);