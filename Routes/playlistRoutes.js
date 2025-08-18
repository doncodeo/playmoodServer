const express = require('express');
const router = express.Router();
const {
    createPlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    getPlaylist,
    getUserPlaylists,
    getPublicUserPlaylists,
    updatePlaylist,
    deletePlaylist,
} = require('../controllers/playlistController');
const { protect } = require('../middleware/authmiddleware'); 

/**
 * @swagger
 * /api/playlists/user/{userId}/public:
 *   get:
 *     summary: Get all public playlists for a user
 *     description: Retrieves all public playlists for a specific user.
 *     tags: [Playlists]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Public playlists retrieved successfully
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: public, max-age=300
 *           ETag:
 *             schema:
 *               type: string
 *               example: "user-public-playlists-682fa4973b7d2a9c142724e3-2-1697059200000"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Public playlists retrieved successfully
 *                 playlists:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Playlist'
 *       304:
 *         description: Not Modified (ETag match)
 *       400:
 *         description: Invalid user ID
 *       500:
 *         description: Server error
 */
router.get('/user/:userId/public', getPublicUserPlaylists);

/**
 * @swagger
 * /api/playlists:
 *   post:
 *     summary: Create a new playlist
 *     description: Creates a new playlist for the authenticated user. Visibility can be public, private, or unlisted.
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Workout Motivation
 *               description:
 *                 type: string
 *                 example: High-energy fitness videos
 *               visibility:
 *                 type: string
 *                 enum: [public, private, unlisted]
 *                 example: public
 *     responses:
 *       201:
 *         description: Playlist created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Playlist created successfully
 *                 playlist:
 *                   $ref: '#/components/schemas/Playlist'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized - Missing or invalid JWT
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/', protect, createPlaylist);

/**
 * @swagger
 * /api/playlists/{playlistId}/videos/{contentId}:
 *   post:
 *     summary: Add a video to a playlist
 *     description: Adds a video to the specified playlist. Only the playlist owner can add videos.
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playlistId
 *         required: true
 *         schema:
 *           type: string
 *         description: Playlist ID
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Content ID
 *     responses:
 *       200:
 *         description: Video added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Video added to playlist successfully
 *                 playlist:
 *                   $ref: '#/components/schemas/Playlist'
 *       400:
 *         description: Invalid ID or video already in playlist
 *       401:
 *         description: Unauthorized - Missing or invalid JWT
 *       403:
 *         description: Not authorized to modify playlist
 *       404:
 *         description: Playlist or content not found
 *       500:
 *         description: Server error
 */
router.post('/:playlistId/videos/:contentId', protect, addVideoToPlaylist);

/**
 * @swagger
 * /api/playlists/{playlistId}/videos/{contentId}:
 *   delete:
 *     summary: Remove a video from a playlist
 *     description: Removes a video from the specified playlist. Only the playlist owner can remove videos.
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playlistId
 *         required: true
 *         schema:
 *           type: string
 *         description: Playlist ID
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Content ID
 *     responses:
 *       200:
 *         description: Video removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Video removed from playlist successfully
 *                 playlist:
 *                   $ref: '#/components/schemas/Playlist'
 *       400:
 *         description: Invalid ID or video not in playlist
 *       401:
 *         description: Unauthorized - Missing or invalid JWT
 *       403:
 *         description: Not authorized to modify playlist
 *       404:
 *         description: Playlist not found
 *       500:
 *         description: Server error
 */
router.delete('/:playlistId/videos/:contentId', protect, removeVideoFromPlaylist);

/**
 * @swagger
 * /api/playlists/{playlistId}:
 *   get:
 *     summary: Get a specific playlist
 *     description: Retrieves a playlist by ID. Private playlists are only accessible to the owner.
 *     tags: [Playlists]
 *     parameters:
 *       - in: path
 *         name: playlistId
 *         required: true
 *         schema:
 *           type: string
 *         description: Playlist ID
 *     responses:
 *       200:
 *         description: Playlist retrieved successfully
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: private, max-age=300
 *           ETag:
 *             schema:
 *               type: string
 *               example: "playlist-684a123b456c789d12345678-1697059200000"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Playlist retrieved successfully
 *                 playlist:
 *                   $ref: '#/components/schemas/Playlist'
 *       304:
 *         description: Not Modified (ETag match)
 *       400:
 *         description: Invalid playlist ID
 *       403:
 *         description: Not authorized to view playlist
 *       404:
 *         description: Playlist not found
 *       500:
 *         description: Server error
 */
router.get('/:playlistId', getPlaylist);

/**
 * @swagger
 * /api/playlists/user/{userId}:
 *   get:
 *     summary: Get all playlists for a user
 *     description: Retrieves all public and unlisted playlists for a user, or all playlists if the requester is the user.
 *     tags: [Playlists]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Playlists retrieved successfully
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: private, max-age=300
 *           ETag:
 *             schema:
 *               type: string
 *               example: "user-playlists-682fa4973b7d2a9c142724e3-2-1697059200000"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Playlists retrieved successfully
 *                 playlists:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Playlist'
 *       304:
 *         description: Not Modified (ETag match)
 *       400:
 *         description: Invalid user ID
 *       500:
 *         description: Server error
 */
router.get('/user/:userId', getUserPlaylists);

/**
 * @swagger
 * /api/playlists/{playlistId}:
 *   put:
 *     summary: Update a playlist
 *     description: Updates the name, description, or visibility of a playlist. Only the playlist owner can update.
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playlistId
 *         required: true
 *         schema:
 *           type: string
 *         description: Playlist ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Playlist Name
 *               description:
 *                 type: string
 *                 example: Updated description
 *               visibility:
 *                 type: string
 *                 enum: [public, private, unlisted]
 *                 example: private
 *     responses:
 *       200:
 *         description: Playlist updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Playlist updated successfully
 *                 playlist:
 *                   $ref: '#/components/schemas/Playlist'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized - Missing or invalid JWT
 *       403:
 *         description: Not authorized to update playlist
 *       404:
 *         description: Playlist not found
 *       500:
 *         description: Server error
 */
router.put('/:playlistId', protect, updatePlaylist);

/**
 * @swagger
 * /api/playlists/{playlistId}:
 *   delete:
 *     summary: Delete a playlist
 *     description: Deletes a playlist. Only the playlist owner can delete.
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playlistId
 *         required: true
 *         schema:
 *           type: string
 *         description: Playlist ID
 *     responses:
 *       200:
 *         description: Playlist deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Playlist deleted successfully
 *       400:
 *         description: Invalid playlist ID
 *       401:
 *         description: Unauthorized - Missing or invalid JWT
 *       403:
 *         description: Not authorized to delete playlist
 *       404:
 *         description: Playlist not found
 *       500:
 *         description: Server error
 */
router.delete('/:playlistId', protect, deletePlaylist);

module.exports = router;