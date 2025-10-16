const express = require('express');
const router = express.Router();
const { 
    getContent, 
    getRecentContent,
    getTopTenContent,
    getRecommendedContent,
    getRecentCreatorContent,
    createContent,
    generateUploadSignature,
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
    combineVideosByIds,
    likeContent,
    unlikeContent,
} = require('../controllers/contentController');
const { protect, admin } = require('../middleware/authmiddleware');

/**
 * @swagger
 * /api/content/{id}/like:
 *   put:
 *     summary: Like a content item
 *     description: Allows an authenticated user to like a specific content item.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the content to like
 *     responses:
 *       200:
 *         description: Content liked successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/content/{id}/unlike:
 *   put:
 *     summary: Unlike a content item
 *     description: Allows an authenticated user to unlike a specific content item.
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the content to unlike
 *     responses:
 *       200:
 *         description: Content unliked successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/content/combine:
 *   post:
 *     summary: Combine existing videos and remove silences
 *     description: Merges 2 to 5 existing video clips into a single video and removes silences. This is an admin-only feature that runs as a background process.
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
 *               - title
 *               - category
 *               - description
 *               - credit
 *               - contentIds
 *             properties:
 *               title:
 *                 type: string
 *                 example: Combined Existing Videos
 *               category:
 *                 type: string
 *                 example: Education
 *               description:
 *                 type: string
 *                 example: A great video combined from existing content.
 *               credit:
 *                 type: string
 *                 example: Admin
 *               contentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: An array of 2 to 5 content IDs to be combined.
 *                 example: ["65a6fc7b72128447ad32024e", "65a8025e3af4e7929b379e7b"]
 *     responses:
 *       202:
 *         description: Accepted for processing. The video combination has started in the background. The user will be notified upon completion.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Video combination process started. You will be notified upon completion."
 *       400:
 *         description: Missing fields or invalid number of content IDs.
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */

router.route('/combine').post(protect, admin, combineVideosByIds);

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
 * /api/content/signature:
 *   post:
 *     summary: "Step 1: Generate Cloudinary Upload Signature"
 *     description: "Generates a secure, one-time signature for direct client-side uploads to Cloudinary. This is the **first step** in the content creation process. The client must send an empty POST request to this endpoint to receive the signature, timestamp, and API key needed for the direct upload."
 *     tags: [Content]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: "The request body should be an empty object."
 *             example: {}
 *     responses:
 *       200:
 *         description: "Signature generated successfully. The client should use these details to upload the file directly to Cloudinary."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signature:
 *                   type: string
 *                   example: "a1b2c3d4e5f6..."
 *                 timestamp:
 *                   type: number
 *                   example: 1678886400
 *                 api_key:
 *                   type: string
 *                   example: "123456789012345"
 *       401:
 *         description: "Unauthorized - JWT token is missing or invalid."
 *       500:
 *         description: "Server error while generating the signature."
 */
router.route('/signature').post(protect, generateUploadSignature);

/**
 * @swagger
 * /api/content:
 *   post:
 *     summary: "Step 2: Create Content Record After Direct Upload"
 *     description: "This is the **second and final step** of the content creation process. After the client has successfully uploaded the video (and optionally, a thumbnail) directly to Cloudinary using the signature from Step 1, it must call this endpoint. The request should include the Cloudinary response (`public_id` and `url` for the video) and all other content metadata. The server will then create the content record in the database and queue a background job for video processing and AI analysis."
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
 *               - title
 *               - category
 *               - description
 *               - credit
 *               - userId
 *               - video
 *               - previewStart
 *               - previewEnd
 *             properties:
 *               title:
 *                 type: string
 *                 example: "My Awesome Video"
 *               category:
 *                 type: string
 *                 example: "Entertainment"
 *               description:
 *                 type: string
 *                 example: "A fun video about..."
 *               credit:
 *                 type: string
 *                 example: "John Doe"
 *               userId:
 *                 type: string
 *                 description: "The ID of the user creating the content."
 *                 example: "65a8025e3af4e7929b379e7a"
 *               previewStart:
 *                 type: number
 *                 description: "The start time (in seconds) for the 10-second video preview."
 *                 example: 30
 *               previewEnd:
 *                 type: number
 *                 description: "The end time (in seconds) for the 10-second video preview. Must be exactly 10 seconds after previewStart."
 *                 example: 40
 *               languageCode:
 *                 type: string
 *                 description: "Optional language code for the video (e.g., 'en-US')."
 *                 example: "en-US"
 *               video:
 *                 type: object
 *                 description: "The Cloudinary response object for the uploaded video. This is required."
 *                 required: [public_id, url]
 *                 properties:
 *                   public_id:
 *                     type: string
 *                     description: "The public_id returned by Cloudinary after the video upload."
 *                     example: "videos/sample_video_123"
 *                   url:
 *                     type: string
 *                     description: "The secure URL returned by Cloudinary after the video upload."
 *                     example: "https://res.cloudinary.com/.../video.mp4"
 *               thumbnail:
 *                 type: object
 *                 description: "The Cloudinary response object for the uploaded thumbnail. This is optional. If not provided, a thumbnail will be generated automatically from the video."
 *                 properties:
 *                   public_id:
 *                     type: string
 *                     description: "The public_id returned by Cloudinary after the thumbnail upload."
 *                     example: "thumbnails/sample_thumb_456"
 *                   url:
 *                     type: string
 *                     description: "The secure URL returned by Cloudinary after the thumbnail upload."
 *                     example: "https://res.cloudinary.com/.../thumb.jpg"
 *     responses:
 *       202:
 *         description: "Accepted. The upload has been received and is being processed in the background. The user will be notified upon completion."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Upload received and is being processed. You will be notified upon completion."
 *                 contentId:
 *                   type: string
 *                   description: "The ID of the newly created content record."
 *                   example: "65a8025e3af4e7929b379e7b"
 *                 status:
 *                   type: string
 *                   example: "processing"
 *       400:
 *         description: "Bad Request - Missing required fields, invalid data (e.g., invalid preview timeline), or malformed Cloudinary data."
 *       401:
 *         description: "Unauthorized - JWT token is missing or invalid."
 *       403:
 *         description: "Forbidden - The user does not have the 'creator' or 'admin' role."
 *       500:
 *         description: "Server Error - An error occurred while initiating the upload process."
 */
router.route('/').post(protect, createContent);


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

router.route('/:id/like').put(protect, likeContent);
router.route('/:id/unlike').put(protect, unlikeContent);

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
router.route('/:id').put(protect, updateContent);

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

module.exports = router;