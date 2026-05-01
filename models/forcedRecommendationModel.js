const mongoose = require('mongoose');

const forcedRecommendationSchema = new mongoose.Schema({
    contentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contents',
        required: true,
        index: true,
    },
    reason: {
        type: String,
        default: '',
        trim: true,
    },
    priority: {
        type: Number,
        default: 100,
        min: 0,
        max: 1000,
    },
    startsAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    endsAt: {
        type: Date,
        default: null,
        index: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'profiles',
        required: true,
    },
}, { timestamps: true });

module.exports = mongoose.model('ForcedRecommendation', forcedRecommendationSchema);
