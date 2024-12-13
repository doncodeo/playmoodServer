const mongoose = require('mongoose');

const userRoles = ['user', 'creator', 'admin'];

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter your full name"]
    },
    email: {
        type: String,
        required: [true, "Please enter your email"],
        unique: true
    },
    password: {
        type: String,
        required: [true, "Please enter your password"]
    },
    role: {
        type: String,
        enum: userRoles,
        default: "user"
    },
    profileImage: {
        type: String,
    },
    cloudinary_id: {
        type: String,
    },
    country: {
        type: String,
        // required: [true, "Please enter your country"]
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
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contents' }],
    watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contents' }],
    history: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contents' }],
    hasReadPrivacyPolicy: {
        type: Boolean,
        default: false,
    },
    subscriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'profiles' }], // Users subscribed to other creators
    subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'profiles' }],  // Users who subscribed to this 
    about: {
        type: String,
        default: "This is my channel!"
    },
    bannerImage: {
        type: String,
        default: "https://img.freepik.com/free-vector/gradient-colored-youtube-banner_23-2149209334.jpg"
    },
    communityPosts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CommunityPost'
    }],
    videoProgress: [{
        contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contents' },
        progress: { type: Number, default: 0 },
    }],
}, {
    timestamps: true,
});

module.exports = mongoose.model('profiles', userSchema);

