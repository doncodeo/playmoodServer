const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const Analytics = require('../models/analyticsModel');

// Helper function to get date ranges
const getDateRanges = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(new Date().setDate(today.getDate() - 1));
    const sevenDaysAgo = new Date(new Date().setDate(today.getDate() - 7));
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));

    return { today, yesterday, sevenDaysAgo, thirtyDaysAgo };
};

// @desc    Get platform-wide analytics
// @route   GET /api/analytics/admin/platform
// @access  Private (Admin)
const getPlatformAnalytics = asyncHandler(async (req, res) => {
    const { today, thirtyDaysAgo } = getDateRanges();

    // Caching logic - check if we have recent stats
    const cachedStats = await Analytics.findOne({ type: 'daily_platform_stats', date: { $gte: today } });
    if (cachedStats && cachedStats.data) {
        return res.status(200).json(cachedStats.data);
    }

    // Fallback to live calculation if cache is stale or missing
    const totalUsers = await User.countDocuments();
    const newSignupsToday = await User.countDocuments({ createdAt: { $gte: today } });
    const totalVideos = await Content.countDocuments();
    const newUploadsToday = await Content.countDocuments({ createdAt: { $gte: today } });

    const trendingVideos = await Content.find({ isApproved: true, createdAt: { $gte: thirtyDaysAgo } })
        .sort({ views: -1 })
        .limit(5)
        .populate('user', 'name profileImage');

    const mostActiveCreators = await Content.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$user', uploadCount: { $sum: 1 } } },
        { $sort: { uploadCount: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: 'profiles', // Corrected collection name
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
        users: { total: totalUsers, newSignupsToday },
        content: { total: totalVideos, newUploadsToday },
        trendingVideos,
        mostActiveCreators
    };

    res.status(200).json(platformStats);
});


// @desc    Get user demographics
// @route   GET /api/analytics/admin/user-demographics
// @access  Private (Admin)
const getUserDemographics = asyncHandler(async (req, res) => {
    const demographics = await User.aggregate([
        { $match: { country: { $ne: null, $ne: "" } } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { country: '$_id', count: 1, _id: 0 } }
    ]);

    res.status(200).json(demographics);
});

// @desc    Get moderation analytics
// @route   GET /api/analytics/admin/moderation
// @access  Private (Admin)
const getModerationAnalytics = asyncHandler(async (req, res) => {
    const { thirtyDaysAgo } = getDateRanges();

    const totalRejected = await Content.countDocuments({ isApproved: false, rejectionReason: { $exists: true, $ne: null } });
    const rejectedLast30Days = await Content.countDocuments({ isApproved: false, rejectionReason: { $exists: true, $ne: null }, createdAt: { $gte: thirtyDaysAgo } });

    const commonRejectionReasons = await Content.aggregate([
        { $match: { isApproved: false, rejectionReason: { $exists: true, $ne: null, $ne: "" } } },
        { $group: { _id: '$rejectionReason', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { reason: '$_id', count: 1, _id: 0 } }
    ]);

    const moderationStats = {
        rejectedContent: {
            total: totalRejected,
            last30Days: rejectedLast30Days
        },
        commonRejectionReasons
    };

    res.status(200).json(moderationStats);
});


// @desc    Get creator's dashboard analytics
// @route   GET /api/analytics/creator/dashboard
// @access  Private (Creator or Admin)
const getCreatorDashboard = asyncHandler(async (req, res) => {
    const creatorId = new mongoose.Types.ObjectId(req.user.id);

    const stats = await Content.aggregate([
        { $match: { user: creatorId } },
        {
            $group: {
                _id: null,
                totalUploads: { $sum: 1 },
                active: { $sum: { $cond: [{ $eq: ['$isApproved', true] }, 1, 0] } },
                rejected: { $sum: { $cond: [{ $and: [{ $eq: ['$isApproved', false] }, { $ne: ['$rejectionReason', null] }] }, 1, 0] } },
                pending: { $sum: { $cond: [{ $and: [{ $eq: ['$isApproved', false] }, { $eq: ['$rejectionReason', null] }] }, 1, 0] } },
                processing: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
                totalViews: { $sum: { $cond: [{ $eq: ['$isApproved', true] }, '$views', 0] } },
                totalLikes: { $sum: { $cond: [{ $eq: ['$isApproved', true] }, { $size: '$likes' }, 0] } },
                totalComments: { $sum: { $cond: [{ $eq: ['$isApproved', true] }, { $size: '$comments' }, 0] } }
            }
        }
    ]);

    const creator = await User.findById(creatorId).select('subscribers');
    const totalSubscribers = creator ? creator.subscribers.length : 0;

    const result = stats[0] || {};

    const dashboardData = {
        uploads: {
            total: result.totalUploads || 0,
            status: {
                active: result.active || 0,
                pending: result.pending || 0,
                rejected: result.rejected || 0,
                processing: result.processing || 0
            }
        },
        performance: {
            totalViews: result.totalViews || 0,
            totalLikes: result.totalLikes || 0,
            totalComments: result.totalComments || 0
        },
        audience: { totalSubscribers }
    };

    res.status(200).json(dashboardData);
});


// @desc    Get video performance comparison
// @route   GET /api/analytics/creator/performance-comparison
// @access  Private (Creator or Admin)
const getVideoPerformanceComparison = asyncHandler(async (req, res) => {
    const creatorId = req.user.id;

    const allVideos = await Content.find({ user: creatorId, isApproved: true })
        .sort({ views: -1 })
        .select('title views likes comments createdAt');

    const top5 = allVideos.slice(0, 5);
    const bottom5 = allVideos.length > 5 ? allVideos.slice(-5).reverse() : [];

    res.status(200).json({ top5, bottom5 });
});

// @desc    Get engagement trends
// @route   GET /api/analytics/creator/engagement-trends
// @access  Private (Creator or Admin)
const getEngagementTrends = asyncHandler(async (req, res) => {
    const creatorId = new mongoose.Types.ObjectId(req.user.id);

    const engagementByDay = await Content.aggregate([
        { $match: { user: creatorId, isApproved: true } },
        { $project: { dayOfWeek: { $dayOfWeek: '$createdAt' }, views: 1, likes: { $size: '$likes' }, comments: { $size: '$comments' } } },
        { $group: { _id: '$dayOfWeek', avgViews: { $avg: '$views' }, avgLikes: { $avg: '$likes' }, avgComments: { $avg: '$comments' } } },
        { $sort: { _id: 1 } }
    ]);

    const engagementByHour = await Content.aggregate([
        { $match: { user: creatorId, isApproved: true } },
        { $project: { hourOfDay: { $hour: '$createdAt' }, views: 1, likes: { $size: '$likes' }, comments: { $size: '$comments' } } },
        { $group: { _id: '$hourOfDay', avgViews: { $avg: '$views' }, avgLikes: { $avg: '$likes' }, avgComments: { $avg: '$comments' } } },
        { $sort: { _id: 1 } }
    ]);

    const performanceByCategory = await Content.aggregate([
        { $match: { user: creatorId, isApproved: true } },
        { $group: { _id: '$category', totalVideos: { $sum: 1 }, avgViews: { $avg: '$views' }, avgLikes: { $avg: { $size: '$likes' } }, avgComments: { $avg: { $size: '$comments' } } } },
        { $sort: { avgViews: -1 } }
    ]);

    res.status(200).json({ engagementByDay, engagementByHour, performanceByCategory });
});

// @desc    Get watch time analytics for a video
// @route   GET /api/analytics/creator/watch-time/:videoId
// @access  Private (Creator or Admin)
const getWatchTimeAnalytics = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const creatorId = req.user.id;

    const content = await Content.findOne({ _id: videoId, user: creatorId });
    if (!content) {
        return res.status(404).json({ error: 'Content not found or you do not have permission to view its analytics.' });
    }

    const watchTimeStatsResult = await User.aggregate([
        { $unwind: '$videoProgress' },
        { $match: { 'videoProgress.contentId': new mongoose.Types.ObjectId(videoId) } },
        { $group: { _id: null, totalWatchTime: { $sum: '$videoProgress.progress' }, totalViewersWithProgress: { $sum: 1 } } }
    ]);

    const stats = watchTimeStatsResult[0];
    if (!stats) {
        return res.status(200).json({ averageWatchDuration: 0, totalWatchTime: 0, totalViewersWithProgress: 0 });
    }

    const averageWatchDuration = stats.totalWatchTime / stats.totalViewersWithProgress;

    res.status(200).json({
        averageWatchDuration,
        totalWatchTime: stats.totalWatchTime,
        totalViewersWithProgress: stats.totalViewersWithProgress
    });
});

module.exports = {
    getPlatformAnalytics,
    getUserDemographics,
    getModerationAnalytics,
    getCreatorDashboard,
    getVideoPerformanceComparison,
    getEngagementTrends,
    getWatchTimeAnalytics
};