const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            'daily_platform_stats',
            'weekly_platform_stats',
            'monthly_platform_stats',
            'trending_videos',
            'active_creators',
            'user_demographics',
            'moderation_stats'
        ],
        index: true
    },
    date: { // For daily, or start date for weekly/monthly
        type: Date,
        index: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('Analytics', analyticsSchema);