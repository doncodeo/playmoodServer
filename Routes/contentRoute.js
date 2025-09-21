const express = require('express');
const router = express.Router();
const { 
    getContent, 
    getRecentContent,
    getTopTenContent,
    getRecommendedContent,
    getRecentCreatorContent,
    createContent, 
    addComment,
    getComments,
    updateContent, 
    deleteContent, 
    getContentById, 
    approveContent,
    rejectContent,
    getUnapprovedContent,
    saveVideoProgress,
    getVideoProgress,
    ContinueWatching,
    addWatchlist,
    getWatchlist,
    removeWatchlist,
    combineVideos,
} = require('../controllers/contentController');
const upload = require('../middleware/multer');
const { protect, admin } = require('../middleware/authmiddleware');

/**
 * @swagger
 * /api/content/combine:
 *   post:
 *     summary: Combine multiple videos and remove silences
 *     description: Merges 2 to 5 video clips into a single video and removes silences. This is an admin-only feature.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - category
 *               - description
 *               - credit
 *               - videos
 *             properties:
 *               title:
 *                 type: string
 *                 example: Combined Awesome Video
 *               category:
 *                 type: string
 *                 example: Entertainment
 *               description:
 *                 type: string
 *                 example: A fun video combined from multiple clips.
 *               credit:
 *                 type: string
 *                 example: Admin Productions
 *               videos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: 2 to 5 video files to be combined.
 *     responses:
 *       201:
 *         description: Content combined and created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Content'
 *       400:
 *         description: Missing fields, invalid number of files, or invalid file types.
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.route('/combine').post(protect, admin, upload.array('videos', 5), combineVideos);

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
router.route('/').get(getContent);    

/**
 * @swagger
 * /api/content:
 *   post:
 *     summary: Create new content
 *     description: Creates a new content item with a video, optional thumbnail, and a 10-second preview segment. Only creators and admins can create content. Admins' content is auto-approved; creators' content requires admin approval.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - category
 *               - description
 *               - credit
 *               - userId
 *               - files
 *               - previewStart
 *               - previewEnd
 *             properties:
 *               title:
 *                 type: string
 *                 example: My Awesome Video
 *               category:
 *                 type: string
 *                 example: Entertainment
 *               description:
 *                 type: string
 *                 example: A fun video about...
 *               credit:
 *                 type: string
 *                 example: John Doe
 *               userId:
 *                 type: string
 *                 example: 65a8025e3af4e7929b379e7a
 *               previewStart:
 *                 type: number
 *                 example: 30
 *                 description: Start time of the 10-second preview (in seconds)
 *               previewEnd:
 *                 type: number
 *                 example: 40
 *                 description: End time of the 10-second preview (in seconds)
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Video file (required) and optional thumbnail image
 *     responses:
 *       201:
 *         description: Content created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: 65a8025e3af4e7929b379e7b
 *                 user:
 *                   type: string
 *                   example: 65a8025e3af4e7929b379e7a
 *                 title:
 *                   type: string
 *                   example: My Awesome Video
 *                 category:
 *                   type: string
 *                   example: Entertainment
 *                 description:
 *                   type: string
 *                   example: A fun video about...
 *                 credit:
 *                   type: string
 *                   example: John Doe
 *                 thumbnail:
 *                   type: string
 *                   example: https://res.cloudinary.com/.../thumbnail.jpg
 *                 video:
 *                   type: string
 *                   example: https://res.cloudinary.com/.../video.mp4
 *                 cloudinary_video_id:
 *                   type: string
 *                   example: videos/video123
 *                 cloudinary_thumbnail_id:
 *                   type: string
 *                   example: thumbnails/thumb123
 *                 shortPreview:
 *                   type: object
 *                   properties:
 *                     start:
 *                       type: number
 *                       example: 30
 *                     end:
 *                       type: number
 *                       example: 40
 *                 isApproved:
 *                   type: boolean
 *                   example: false
 *                 previewUrl:
 *                   type: string
 *                   example: https://res.cloudinary.com/.../so_30,eo_40/video123.mp4
 *       400:
 *         description: Missing fields, invalid file types, or invalid preview timeline
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not a creator or admin
 *       500:
 *         description: Server error
 */
router.route('/').post(protect, upload.array('files', 2), createContent);


/**
 * @swagger
 * /api/content/{contentId}/comment:
 *   post:
 *     summary: Add a comment to content
 *     description: Allows an authenticated user to post a comment on a specific content item.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the content to comment on
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 example: Great video! Loved the content!
 *                 description: The comment text (max 1000 characters)
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Comment added successfully!
 *                 comment:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: 65a8025e3af4e7929b379e7a
 *                         name:
 *                           type: string
 *                           example: John Doe
 *                         profileImage:
 *                           type: string
 *                           example: https://res.cloudinary.com/.../profile.jpg
 *                     text:
 *                       type: string
 *                       example: Great video! Loved the content!
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-05-27T15:40:59.819Z
 *       400:
 *         description: Missing or invalid comment text
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Content or user not found
 *       500:
 *         description: Server error
 */
router.route('/:contentId/comment').post(protect, addComment);


/**
 * @swagger
 * /api/content/{id}/comments:
 *   get:
 *     summary: Get comments for a content item
 *     description: Retrieves all comments for a specific content item, with pagination.
 *     tags: [Content]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the content
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of comments per page
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Comments retrieved successfully
 *                 totalComments:
 *                   type: integer
 *                   example: 25
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 comments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         properties:
 *                           _id: { type: string }
 *                           name: { type: string }
 *                           profileImage: { type: string }
 *                       text: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *       400:
 *         description: Invalid content ID
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.route('/:id/comments').get(getComments);



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
router.route('/new').get(getRecentContent);

/**
 * @swagger
 * /top-ten:
 *   get:
 *     summary: Get top 10 most viewed content
 *     description: Retrieves the 10 most viewed approved content items, sorted by views in descending order.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of top 10 content
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
router.route('/top-ten').get(getTopTenContent);

/**
 * @swagger
 * /recommended/{id}:
 *   get:
 *     summary: Get recommended content based on category
 *     description: Retrieves a list of approved content items that share the same category as the specified content ID.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the content to base recommendations on
 *     responses:
 *       200:
 *         description: List of recommended content
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Content'
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.route('/recommended/:id').get(protect, getRecommendedContent);

/**
 * @swagger
 * /api/content/{userId}/recent:
 *   get:
 *     summary: Get the most recent approved content for a specific creator
 *     description: Retrieves the single most recent approved content item created by the specified creator, sorted by creation date. Includes caching with ETag.
 *     tags: [Content]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Creator's user ID
 *     responses:
 *       200:
 *         description: Most recent creator content retrieved successfully
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: private, max-age=900
 *           ETag:
 *             schema:
 *               type: string
 *               example: "creator-recent-682fa4973b7d2a9c142724e3-1697059200000"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Most recent creator content retrieved successfully
 *                 content:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/Content'
 *                     - type: null
 *       304:
 *         description: Not Modified (ETag match)
 *       400:
 *         description: Invalid creator ID format or user is not a creator
 *       404:
 *         description: Creator not found
 *       500:
 *         description: Server error
 */
router.route('/:userId/recent').get(getRecentCreatorContent);

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
router.route('/:id').get(getContentById);

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
 * /api/content/approve/{id}:
 *   put:
 *     summary: Approve and optionally update content
 *     description: Approves a specific content item by ID (admin only). The admin can also optionally update content fields like title, category, description, and credit in the same request.
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Updated Content Title"
 *               category:
 *                 type: string
 *                 example: "Educational"
 *               description:
 *                 type: string
 *                 example: "This is the updated and approved description."
 *               credit:
 *                 type: string
 *                 example: "Updated Credits"
 *     responses:
 *       200:
 *         description: Content approved and updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Content approved and updated successfully
 *                 content:
 *                   $ref: '#/components/schemas/Content'
 *       400:
 *         description: Invalid content ID
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
 * /api/content/reject/{id}:
 *   put:
 *     summary: Reject content
 *     description: Rejects a specific content item by ID with a reason (admin only).
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 example: Content does not meet quality standards
 *     responses:
 *       200:
 *         description: Content rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Content rejected successfully
 *                 content:
 *                   $ref: '#/components/schemas/Content'
 *       400:
 *         description: Invalid content ID or rejection reason
 *       401:
 *         description: Unauthorized - Missing or invalid JWT token
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.route('/reject/:id').put(protect, rejectContent);

/**
 * @swagger
 * /api/content/progress/{contentId}:
 *   post:
 *     summary: Update video progress
 *     description: Updates the playback progress for a specific video for the authenticated user.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Content ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               progress:
 *                 type: number
 *                 example: 120.5
 *                 description: Playback progress in seconds
 *     responses:
 *       200:
 *         description: Video progress updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Video progress updated successfully
 *                 progress:
 *                   type: number
 *                 contentId:
 *                   type: string
 *       400:
 *         description: Invalid content ID or progress value
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or content not found
 *       500:
 *         description: Server error
 */
router.route('/progress/:contentId').post(protect, saveVideoProgress);

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
 * /api/content/continue-watching:
 *   get:
 *     summary: Get continue watching list
 *     description: Retrieves all videos the authenticated user has started watching, including video details and playback progress. Includes caching with ETag.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Continue watching list retrieved successfully
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: private, max-age=300
 *           ETag:
 *             schema:
 *               type: string
 *               example: "continue-watching-682fa4973b7d2a9c142724e3-[...]"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Continue watching list retrieved successfully
 *                 continueWatching:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       contentId:
 *                         type: string
 *                         example: 6835dd0b1d00e49b7470f471
 *                       title:
 *                         type: string
 *                       category:
 *                         type: string
 *                       description:
 *                         type: string
 *                       thumbnail:
 *                         type: string
 *                       video:
 *                         type: string
 *                       videoPreviewUrl:
 *                         type: string
 *                       duration:
 *                         type: number
 *                       views:
 *                         type: number
 *                       likes:
 *                         type: array
 *                         items:
 *                           type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       progress:
 *                         type: number
 *       304:
 *         description: Not Modified (ETag match)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/continue-watching').get(protect, ContinueWatching);

/**
 * @swagger
 * /api/content/watchlist/add:
 *   post:
 *     summary: Add content to watchlist
 *     description: Adds a content ID to the authenticated user's watchlist.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: "65a6fc7b72128447ad32024e"
 *     responses:
 *       200:
 *         description: Content added to watchlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contentId:
 *                   type: string
 *                   example: "65a6fc7b72128447ad32024e"
 *                 message:
 *                   type: string
 *                   example: Content added to watchlist!
 *       400:
 *         description: Content already in watchlist or invalid ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or content not found
 *       500:
 *         description: Server error
 */
router.route('/watchlist/add').post(protect, addWatchlist);

/**
 * @swagger
 * /api/content/watchlist/all:
 *   get:
 *     summary: Get user's watchlist
 *     description: Retrieves the watchlist of the authenticated user.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User's watchlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 watchList:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Content'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/watchlist/all').get(protect, getWatchlist);

/**
 * @swagger 
 * /api/content/watchlist/remove:
 *   post:
 *     summary: Remove content from watchlist
 *     description: Removes a content ID from the authenticated user's watchlist.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: "65a6fc7b72128447ad32024e"
 *     responses:
 *       200:
 *         description: Content removed from watchlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contentId:
 *                   type: string
 *                   example: "65a6fc7b72128447ad32024e"
 *                 message:
 *                   type: string
 *                   example: Content removed from watchlist!
 *       400:
 *         description: Content not in watchlist or invalid ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or content not found
 *       500:
 *         description: Server error
 */
router.route('/watchlist/remove').post(protect, removeWatchlist);

module.exports = router;     