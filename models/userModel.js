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
    },
    subscriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'profiles' }], // Users can subscribe to other creators
    about: {
        type: String,
        default: "This is my channel!"
    },
    bannerImage: {
        type: String,
        default: "https://img.freepik.com/free-vector/gradient-colored-youtube-banner_23-2149209334.jpg?t=st=1724281341~exp=1724284941~hmac=6d8e56e7a1451c38bc2b5c8ab0f2828bb297da4c94ae89e767633e19850eea01&w=996"
    },
    communityPosts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CommunityPost' // You can create a separate schema for community posts if needed
    }]
}, {
    timestamps: true,
});

module.exports = mongoose.model('profiles', userSchema);







// const mongoose = require('mongoose');

// const userRoles = ['user', 'creator', 'admin'];

// const userSchema = new mongoose.Schema({
//     name: {
//         type: String,
//         required: [true, "Please enter your full name"]
//     },
//     email: {
//         type: String,
//         required: [true, "Please enter your email"],
//         unique: true
//     },
//     password: {
//         type: String,
//         required: [true, "Please enter your password"]
//     },
//     role: {
//         type: String,
//         enum: userRoles,
//         default: "user"
//     },
//     profileImage: {
//         type: String,
//     },
//     cloudinary_id: {
//         type: String,
//     },
//     thumbnail_id: {
//         type: String,
//     },
//     likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contents' }],
//     watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contents' }],
//     history: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contents' }],
//     verified: {
//         type: Boolean,
//         default: false
//     },
//     hasReadPrivacyPolicy: {
//         type: Boolean,
//         default: false,
//     },
//     subscriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' }]
// }, {
//     timestamps: true,
// });

// module.exports = mongoose.model('profiles', userSchema);
