const express = require('express');
const router = express.Router();
const { 
    getContent, 
    getRecentContent,
    createContent, 
    updateContent, 
    deleteContent, 
    getContentById, 
    approveContent,
    getUnapprovedContent,
    saveVideoProgress,
    getVideoProgress,
    getWatchlist,
    addToWatchlist
} = require('../controllers/contentController');
const upload = require('../middleware/multer');
const { protect } = require('../middleware/authmiddleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     Content:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 65a6fc7b72128447ad32024e
 *         user:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: 65a8025e3af4e7929b379e7b
 *             name:
 *               type: string
 *               example: John Doe
 *         title:
 *           type: string
 *           example: Sample Video
 *         category:
 *           type: string
 *           example: Entertainment
 *         description:
 *           type: string
 *           example: A fun and engaging video.
 *         credit:
 *           type: string
 *           example: John Doe Productions
 *         thumbnail:
 *           type: string
 *           example: https://res.cloudinary.com/.../thumbnail.jpg
 *         video:
 *           type: string
 *           example: https://res.cloudinary.com/.../video.mp4
 *         cloudinary_video_id:
 *           type: string
 *           example: videos/video123
 *         cloudinary_thumbnail_id:
 *           type: string
 *           example: thumbnails/thumb123
 *         isApproved:
 *           type: boolean
 *           example: true
 *         views:
 *           type: integer
 *           example: 100
 *         viewers:
 *           type: array
 *           items:
 *             type: string
 *           example: ["65a8025e3af4e7929b379e7b"]
 *         viewerIPs:
 *           type: array
 *           items:
 *             type: string
 *           example: ["192.168.1.1"]
 *         likes:
 *           type: array
 *           items:
 *             type: string
 *           example: ["65a8025e3af4e7929b379e7b"]
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-15T12:00:00Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2023-01-15T12:00:00Z
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Get all approved content
 *     description: Retrieves a list of all approved content, populated with the creator's name. Includes caching with ETag.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of approved content
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: private, max-age=900
 *           ETag:
 *             schema:
 *               type: string
 *               example: "all-10-1697059200000"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Content'
 *       304:
 *         description: Not Modified (ETag match)
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       500:
 *         description: Server error
 */
router.route('/').get(protect, getContent);     

/**
 * @swagger
 * /:
 *   post:
 *     summary: Create new content
 *     description: Creates a new content item with video and thumbnail uploads. Sends approval email to admins if created by a non-admin.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Sample Video
 *               category:
 *                 type: string
 *                 example: Entertainment
 *               description:
 *                 type: string
 *                 example: A fun and engaging video.
 *               credit:
 *                 type: string
 *                 example: John Doe Productions
 *               userId:
 *                 type: string
 *                 example: 65a8025e3af4e7929b379e7b
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Video and thumbnail files (exactly 2 files required)
 *     responses:
 *       201:
 *         description: Content created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Content'
 *       400:
 *         description: Missing fields or incorrect number of files
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       403:
 *         description: Unauthorized to create content
 *       500:
 *         description: Server error
 */
router.route('/').post(protect, upload.array('files', 2), createContent);

/**
 * @swagger
 * /new:
 *   get:
 *     summary: Get recent content
 *     description: Retrieves the 10 most recently created approved content items, sorted by creation date. Includes caching with ETag.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of recent content
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: private, max-age=900
 *           ETag:
 *             schema:
 *               type: string
 *               example: "recent-10-1697059200000"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Content'
 *       304:
 *         description: Not Modified (ETag match)
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       500:
 *         description: Server error
 */
router.route('/new').get(protect, getRecentContent);

/**
 * @swagger
 * /unapproved:
 *   get:
 *     summary: Get unapproved content
 *     description: Retrieves a list of unapproved content items (admin only). Includes caching with ETag.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of unapproved content
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: private, max-age=300
 *           ETag:
 *             schema:
 *               type: string
 *               example: "unapproved-5-1697059200000"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Content'
 *       304:
 *         description: Not Modified (ETag match)
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.route('/unapproved').get(protect, getUnapprovedContent);

/**
 * @swagger
 * /{id}:
 *   get:
 *     summary: Get content by ID
 *     description: Retrieves a specific content item by ID, increments view count if not previously viewed by the user or IP. Includes caching with ETag.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the content
 *     responses:
 *       200:
 *         description: Content retrieved successfully
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: private, max-age=3600
 *           ETag:
 *             schema:
 *               type: string
 *               example: "65a6fc7b72128447ad32024e-1697059200000"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Content'
 *       304:
 *         description: Not Modified (ETag match)
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.route('/:id').get(protect, getContentById);

/**
 * @swagger
 * /{id}:
 *   put:
 *     summary: Update content
 *     description: Updates a specific content item by ID, optionally replacing the thumbnail. Only the thumbnail can be updated as a file; other fields are updated via JSON.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the content
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated Video
 *               category:
 *                 type: string
 *                 example: Education
 *               description:
 *                 type: string
 *                 example: Updated description.
 *               credit:
 *                 type: string
 *                 example: Jane Doe Productions
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: Optional new thumbnail file
 *               video:
 *                 type: string
 *                 example: https://res.cloudinary.com/.../new-video.mp4
 *                 description: Optional new video URL
 *               likes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["65a8025e3af4e7929b379e7b"]
 *     responses:
 *       200:
 *         description: Content updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Content'
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.route('/:id').put(protect, upload.single('thumbnail'), updateContent);

/**
 * @swagger
 * /{id}:
 *   delete:
 *     summary: Delete content
 *     description: Deletes a specific content item by ID, including its video and thumbnail from Cloudinary.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the content
 *     responses:
 *       200:
 *         description: Content deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Content deleted successfully
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.route('/:id').delete(protect, deleteContent);

/**
 * @swagger
 * /approve/{id}:
 *   put:
 *     summary: Approve content
 *     description: Approves a specific content item by ID (admin only).
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the content
 *     responses:
 *       200:
 *         description: Content approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Content approved successfully
 *                 content:
 *                   $ref: '#/components/schemas/Content'
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.route('/approve/:id').put(protect, approveContent);

/**
 * @swagger
 * /progress:
 *   post:
 *     summary: Save video progress
 *     description: Saves the playback progress for a specific content item for the authenticated user.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: 65a6fc7b72128447ad32024e
 *               progress:
 *                 type: number
 *                 example: 120.5
 *                 description: Playback progress in seconds
 *     responses:
 *       200:
 *         description: Video progress saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Video progress saved successfully
 *                 contentId:
 *                   type: string
 *                 progress:
 *                   type: number
 *       400:
 *         description: Missing or invalid fields
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       404:
 *         description: Content or user not found
 *       500:
 *         description: Server error
 */
router.route('/progress').post(protect, saveVideoProgress);

/**
 * @swagger
 * /progress/{contentId}:
 *   get:
 *     summary: Get video progress
 *     description: Retrieves the playback progress for a specific content item for the authenticated user. Includes caching with ETag.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the content
 *     responses:
 *       200:
 *         description: Video progress retrieved successfully
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: private, max-age=300
 *           ETag:
 *             schema:
 *               type: string
 *               example: "progress-65a8025e3af4e7929b379e7b-65a6fc7b72128447ad32024e-120.5"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 progress:
 *                   type: number
 *                   example: 120.5
 *       304:
 *         description: Not Modified (ETag match)
 *       400:
 *         description: Content ID required
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/progress/:contentId').get(protect, getVideoProgress);

/**
 * @swagger
 * /watchlist:
 *   get:
 *     summary: Get all saved videos in user's watchlist
 *     description: Retrieves all approved content items in the authenticated user's watchlist, including full content details and playback progress. Includes caching with ETag.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved videos with progress
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: private, max-age=300
 *           ETag:
 *             schema:
 *               type: string
 *               example: "watchlist-65a8025e3af4e7929b379e7b-5-1697059200000-120.5"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Content'
 *                   - type: object
 *                     properties:
 *                       progress:
 *                         type: number
 *                         example: 120.5
 *                         description: Playback progress in seconds
 *       304:
 *         description: Not Modified (ETag match)
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/watchlist').get(protect, getWatchlist);

/**
 * @swagger
 * /watchlist:
 *   post:
 *     summary: Add video to user's watchlist
 *     description: Adds a specific approved content item to the authenticated user's watchlist.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: 65a6fc7b72128447ad32024e
 *                 description: MongoDB ObjectId of the content
 *     responses:
 *       200:
 *         description: Video added to watchlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Video added to watchlist
 *                 contentId:
 *                   type: string
 *       400:
 *         description: Missing content ID or content already in watchlist
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       404:
 *         description: Content or user not found
 *       500:
 *         description: Server error
 */
router.route('/watchlist').post(protect, addToWatchlist);

module.exports = router;