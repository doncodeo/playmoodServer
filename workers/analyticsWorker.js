const Analytics = require('../models/analyticsModel');
const User = require('../models/userModel');
const Content = require('../models/contentModel');

const aggregatePlatformStats = async () => {
    console.log('Running daily platform stats aggregation...');
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));

        // User stats
        const totalUsers = await User.countDocuments();
        const newSignupsToday = await User.countDocuments({ createdAt: { $gte: today } });

        // Content stats
        const totalVideos = await Content.countDocuments();
        const newUploadsToday = await Content.countDocuments({ createdAt: { $gte: today } });

        // Trending videos (top 5 by views in the last 30 days)
        const trendingVideos = await Content.find({ isApproved: true, createdAt: { $gte: thirtyDaysAgo } })
            .sort({ views: -1 })
            .limit(5)
            .populate('user', 'name profileImage');

        // Most active creators (top 5 by uploads in the last 30 days)
        const mostActiveCreators = await Content.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            { $group: { _id: '$user', uploadCount: { $sum: 1 } } },
            { $sort: { uploadCount: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                from: 'users', // Corrected collection name
                    localField: '_id',
                    foreignField: '_id',
                    as: 'creatorInfo'
                }
            },
            { $unwind: '$creatorInfo' },
            {
                $project: {
                    _id: 1,
                    uploadCount: 1,
                    name: '$creatorInfo.name',
                    profileImage: '$creatorInfo.profileImage'
                }
            }
        ]);

        const platformStats = {
            users: {
                total: totalUsers,
                newSignupsToday: newSignupsToday,
            },
            content: {
                total: totalVideos,
                newUploadsToday: newUploadsToday,
            },
            trendingVideos,
            mostActiveCreators
        };

        // Cache the results
        await Analytics.findOneAndUpdate(
            { type: 'daily_platform_stats', date: today },
            { data: platformStats },
            { upsert: true, new: true }
        );
        console.log('Successfully aggregated and cached daily platform stats.');
    } catch (error) {
        console.error('Error aggregating platform stats:', error);
    }
};

module.exports = {
    aggregatePlatformStats
};