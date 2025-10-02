const express = require('express');
const router = express.Router();
const { protect, admin, creator } = require('../middleware/authmiddleware');
const {
    getPlatformAnalytics,
    getUserDemographics,
    getModerationAnalytics,
    getCreatorDashboard,
    getVideoPerformanceComparison,
    getEngagementTrends,
    getWatchTimeAnalytics
} = require('../controllers/analyticsController');

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Endpoints for platform and creator analytics
 */

/**
 * @swagger
 * /api/analytics/admin/platform:
 *   get:
 *     summary: Get platform-wide analytics
 *     description: Retrieves a comprehensive overview of platform statistics, including user and content metrics. Admin access is required.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Platform analytics retrieved successfully.
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token.
 *       403:
 *         description: Forbidden - Admin access required.
 *       500:
 *         description: Server error.
 */
router.route('/admin/platform').get(protect, admin, getPlatformAnalytics);

/**
 * @swagger
 * /api/analytics/admin/user-demographics:
 *   get:
 *     summary: Get user demographics
 *     description: Retrieves the distribution of users by country. Admin access is required.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User demographics retrieved successfully.
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token.
 *       403:
 *         description: Forbidden - Admin access required.
 *       500:
 *         description: Server error.
 */
router.route('/admin/user-demographics').get(protect, admin, getUserDemographics);

/**
 * @swagger
 * /api/analytics/admin/moderation:
 *   get:
 *     summary: Get moderation analytics
 *     description: Retrieves statistics on content moderation, including rejected content and common rejection reasons. Admin access is required.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Moderation analytics retrieved successfully.
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token.
 *       403:
 *         description: Forbidden - Admin access required.
 *       500:
 *         description: Server error.
 */
router.route('/admin/moderation').get(protect, admin, getModerationAnalytics);

/**
 * @swagger
 * /api/analytics/creator/dashboard:
 *   get:
 *     summary: Get creator dashboard analytics
 *     description: Retrieves a personalized analytics dashboard for the authenticated creator.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Creator dashboard analytics retrieved successfully.
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token.
 *       403:
 *         description: Forbidden - Creator access required.
 *       500:
 *         description: Server error.
 */
router.route('/creator/dashboard').get(protect, creator, getCreatorDashboard);

/**
 * @swagger
 * /api/analytics/creator/performance-comparison:
 *   get:
 *     summary: Get video performance comparison
 *     description: Retrieves a comparison of the creator's top 5 and bottom 5 performing videos.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Video performance comparison retrieved successfully.
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token.
 *       403:
 *         description: Forbidden - Creator access required.
 *       500:
 *         description: Server error.
 */
router.route('/creator/performance-comparison').get(protect, creator, getVideoPerformanceComparison);

/**
 * @swagger
 * /api/analytics/creator/engagement-trends:
 *   get:
 *     summary: Get engagement trends
 *     description: Retrieves analytics on engagement trends, such as best posting times and content type performance.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Engagement trends retrieved successfully.
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token.
 *       403:
 *         description: Forbidden - Creator access required.
 *       500:
 *         description: Server error.
 */
router.route('/creator/engagement-trends').get(protect, creator, getEngagementTrends);

/**
 * @swagger
 * /api/analytics/creator/watch-time/{videoId}:
 *   get:
 *     summary: Get watch time analytics for a video
 *     description: Retrieves detailed watch time analytics for a specific video.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the video to retrieve watch time analytics for.
 *     responses:
 *       200:
 *         description: Watch time analytics retrieved successfully.
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token.
 *       403:
 *         description: Forbidden - Creator access required.
 *       404:
 *         description: Content not found or you do not have permission to view its analytics.
 *       500:
 *         description: Server error.
 */
router.route('/creator/watch-time/:videoId').get(protect, creator, getWatchTimeAnalytics);

module.exports = router;