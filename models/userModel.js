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
    thumbnail_id: {
        type: String,
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contents' }],
    watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contents' }],
    history: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contents' }],
    verified: {
        type: Boolean,
        default: false
    },
    hasReadPrivacyPolicy: {
        type: Boolean,
        default: false,
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('profiles', userSchema);
