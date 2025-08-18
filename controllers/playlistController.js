const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const Playlist = require('../models/playlistMoldel');

// @desc    Create a new playlist
// @route   POST /api/playlists
// @access  Private
const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description, visibility } = req.body;
    const userId = req.user.id;

    console.log('Creating playlist for userId:', userId); // Debug

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        console.error('Invalid playlist name:', name);
        return res.status(400).json({ error: 'Playlist name is required and must be a non-empty string' });
    }
    if (description && (typeof description !== 'string' || description.length > 500)) {
        console.error('Invalid description:', description);
        return res.status(400).json({ error: 'Description cannot exceed 500 characters' });
    }
    if (visibility && !['public', 'private', 'unlisted'].includes(visibility)) {
        console.error('Invalid visibility:', visibility);
        return res.status(400).json({ error: 'Visibility must be public, private, or unlisted' });
    }

    try {
        // Verify user exists
        const user = await User.findById(userId).select('name playlists');
        if (!user) {
            console.error('User not found for ID:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        // Create playlist
        const playlist = await Playlist.create({
            user: userId,
            name: name.trim(),
            description: description ? description.trim() : undefined,
            visibility: visibility || 'public',
            videos: [],
        });

        // Update user's playlists
        user.playlists.push(playlist._id);
        await user.save();

        // Populate user details
        const populatedPlaylist = await Playlist.findById(playlist._id).populate('user', 'name profileImage');

        res.status(201).json({
            message: 'Playlist created successfully',
            playlist: populatedPlaylist,
        });
    } catch (error) {
        console.error('Create playlist error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

// @desc    Get all public playlists for a user
// @route   GET /api/playlists/user/:userId/public
// @access  Public
const getPublicUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    console.log('Fetching public playlists for userId:', { userId }); // Debug

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid userId format:', userId);
        return res.status(400).json({ error: 'Invalid user ID format' });
    }

    try {
        // Fetch playlists
        const query = { user: userId, visibility: 'public' };
        const playlists = await Playlist.find(query)
            .sort({ createdAt: -1 })
            .populate('user', 'name profileImage')
            .populate('videos', 'title thumbnail video category');

        console.log('Public user playlists count:', playlists.length); // Debug

        // Generate ETag
        const lastCreated = playlists.length > 0 ? playlists[0].createdAt.getTime() : 0;
        const etag = `"user-public-playlists-${userId}-${playlists.length}-${lastCreated}"`;

        if (req.get('If-None-Match') === etag) {
            return res.status(304).end();
        }

        res.set({
            'Cache-Control': 'public, max-age=300',
            'ETag': etag,
        });

        res.status(200).json({
            message: playlists.length > 0 ? 'Public playlists retrieved successfully' : 'No public playlists found',
            playlists,
        });
    } catch (error) {
        console.error('Get public user playlists error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid data detected', details: error.message });
        }
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

// @desc    Add a video to a playlist
// @route   POST /api/playlists/:playlistId/videos/:contentId
// @access  Private
const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, contentId } = req.params;
    const userId = req.user.id;

    console.log('Adding video to playlist:', { playlistId, contentId, userId }); // Debug

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(playlistId) || !mongoose.Types.ObjectId.isValid(contentId)) {
        console.error('Invalid ID format:', { playlistId, contentId });
        return res.status(400).json({ error: 'Invalid playlist or content ID format' });
    }

    try {
        // Verify playlist exists and belongs to user
        const playlist = await Playlist.findById(playlistId);
        if (!playlist) {
            console.error('Playlist not found:', playlistId);
            return res.status(404).json({ error: 'Playlist not found' });
        }
        if (playlist.user.toString() !== userId) {
            console.error('Unauthorized access to playlist:', { playlistId, userId });
            return res.status(403).json({ error: 'Not authorized to modify this playlist' });
        }

        // Verify content exists and is approved
        const content = await Content.findById(contentId);
        if (!content || !content.isApproved) {
            console.error('Invalid or unapproved content:', contentId);
            return res.status(400).json({ error: 'Content not found or not approved' });
        }

        // Add video if not already in playlist
        if (playlist.videos.map(String).includes(contentId)) {
            return res.status(400).json({ error: 'Video already in playlist' });
        }

        playlist.videos.push(contentId);
        await playlist.save();

        // Populate video details
        const updatedPlaylist = await Playlist.findById(playlistId)
            .populate('user', 'name profileImage')
            .populate('videos', 'title thumbnail video category');

        res.status(200).json({
            message: 'Video added to playlist successfully',
            playlist: updatedPlaylist,
        });
    } catch (error) {
        console.error('Add video to playlist error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

// @desc    Remove a video from a playlist
// @route   DELETE /api/playlists/:playlistId/videos/:contentId
// @access  Private
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, contentId } = req.params;
    const userId = req.user.id;

    console.log('Removing video from playlist:', { playlistId, contentId, userId }); // Debug

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(playlistId) || !mongoose.Types.ObjectId.isValid(contentId)) {
        console.error('Invalid ID format:', { playlistId, contentId });
        return res.status(400).json({ error: 'Invalid playlist or content ID format' });
    }

    try {
        // Verify playlist exists and belongs to user
        const playlist = await Playlist.findById(playlistId);
        if (!playlist) {
            console.error('Playlist not found:', playlistId);
            return res.status(404).json({ error: 'Playlist not found' });
        }
        if (playlist.user.toString() !== userId) {
            console.error('Unauthorized access to playlist:', { playlistId, userId });
            return res.status(403).json({ error: 'Not authorized to modify this playlist' });
        }

        // Remove video
        const videoIndex = playlist.videos.indexOf(contentId);
        if (videoIndex === -1) {
            console.error('Video not in playlist:', contentId);
            return res.status(400).json({ error: 'Video not found in playlist' });
        }

        playlist.videos.splice(videoIndex, 1);
        await playlist.save();

        // Populate video details
        const updatedPlaylist = await Playlist.findById(playlistId)
            .populate('user', 'name profileImage')
            .populate('videos', 'title thumbnail video category');

        res.status(200).json({
            message: 'Video removed from playlist successfully',
            playlist: updatedPlaylist,
        });
    } catch (error) {
        console.error('Remove video from playlist error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

// @desc    Get a specific playlist
// @route   GET /api/playlists/:playlistId
// @access  Public
const getPlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const userId = req.user ? req.user.id : null;

    console.log('Fetching playlist:', { playlistId, userId }); // Debug

    // Validate playlistId
    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        console.error('Invalid playlistId format:', playlistId);
        return res.status(400).json({ error: 'Invalid playlist ID format' });
    }

    try {
        // Fetch playlist
        const playlist = await Playlist.findById(playlistId)
            .populate('user', 'name profileImage')
            .populate('videos', 'title thumbnail video category');

        if (!playlist) {
            console.error('Playlist not found:', playlistId);
            return res.status(404).json({ error: 'Playlist not found' });
        }

        // Check visibility
        if (playlist.visibility === 'private' && (!userId || playlist.user.toString() !== userId)) {
            console.error('Unauthorized access to private playlist:', { playlistId, userId });
            return res.status(403).json({ error: 'Not authorized to view this playlist' });
        }

        // Generate ETag
        const lastUpdated = playlist.updatedAt.getTime();
        const etag = `"playlist-${playlistId}-${lastUpdated}"`;

        if (req.get('If-None-Match') === etag) {
            return res.status(304).end();
        }

        res.set({
            'Cache-Control': 'private, max-age=300',
            'ETag': etag,
        });

        res.status(200).json({
            message: 'Playlist retrieved successfully',
            playlist,
        });
    } catch (error) {
        console.error('Get playlist error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid data detected', details: error.message });
        }
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

// @desc    Get all playlists for a user
// @route   GET /api/playlists/user/:userId
// @access  Public
const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const requestingUserId = req.user ? req.user.id : null;

    console.log('Fetching playlists for userId:', { userId, requestingUserId }); // Debug

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid userId format:', userId);
        return res.status(400).json({ error: 'Invalid user ID format' });
    }

    try {
        // Fetch playlists
        const query = requestingUserId === userId ? { user: userId } : { user: userId, visibility: { $in: ['public', 'unlisted'] } };
        const playlists = await Playlist.find(query)
            .sort({ createdAt: -1 })
            .populate('user', 'name profileImage')
            .populate('videos', 'title thumbnail video category');

        console.log('User playlists count:', playlists.length); // Debug

        // Generate ETag
        const lastCreated = playlists.length > 0 ? playlists[0].createdAt.getTime() : 0;
        const etag = `"user-playlists-${userId}-${playlists.length}-${lastCreated}"`;

        if (req.get('If-None-Match') === etag) {
            return res.status(304).end();
        }

        res.set({
            'Cache-Control': 'private, max-age=300',
            'ETag': etag,
        });

        res.status(200).json({
            message: playlists.length > 0 ? 'Playlists retrieved successfully' : 'No playlists found',
            playlists,
        });
    } catch (error) {
        console.error('Get user playlists error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid data detected', details: error.message });
        }
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

// @desc    Update a playlist
// @route   PUT /api/playlists/:playlistId
// @access  Private
const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { name, description, visibility } = req.body;
    const userId = req.user.id;

    console.log('Updating playlist:', { playlistId, userId }); // Debug

    // Validate playlistId
    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        console.error('Invalid playlistId format:', playlistId);
        return res.status(400).json({ error: 'Invalid playlist ID format' });
    }

    // Validate input
    if (name && (typeof name !== 'string' || name.trim().length === 0)) {
        console.error('Invalid playlist name:', name);
        return res.status(400).json({ error: 'Playlist name must be a non-empty string' });
    }
    if (description && (typeof description !== 'string' || description.length > 500)) {
        console.error('Invalid description:', description);
        return res.status(400).json({ error: 'Description cannot exceed 500 characters' });
    }
    if (visibility && !['public', 'private', 'unlisted'].includes(visibility)) {
        console.error('Invalid visibility:', visibility);
        return res.status(400).json({ error: 'Visibility must be public, private, or unlisted' });
    }

    try {
        // Verify playlist exists and belongs to user
        const playlist = await Playlist.findById(playlistId);
        if (!playlist) {
            console.error('Playlist not found:', playlistId);
            return res.status(404).json({ error: 'Playlist not found' });
        }
        if (playlist.user.toString() !== userId) {
            console.error('Unauthorized access to playlist:', { playlistId, userId });
            return res.status(403).json({ error: 'Not authorized to update this playlist' });
        }

        // Update fields
        if (name) playlist.name = name.trim();
        if (description !== undefined) playlist.description = description ? description.trim() : '';
        if (visibility) playlist.visibility = visibility;

        await playlist.save();

        // Populate updated playlist
        const updatedPlaylist = await Playlist.findById(playlistId)
            .populate('user', 'name profileImage')
            .populate('videos', 'title thumbnail video category');

        res.status(200).json({
            message: 'Playlist updated successfully',
            playlist: updatedPlaylist,
        });
    } catch (error) {
        console.error('Update playlist error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

// @desc    Delete a playlist
// @route   DELETE /api/playlists/:playlistId
// @access  Private
const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const userId = req.user.id;

    console.log('Deleting playlist:', { playlistId, userId }); // Debug

    // Validate playlistId
    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        console.error('Invalid playlistId format:', playlistId);
        return res.status(400).json({ error: 'Invalid playlist ID format' });
    }

    try {
        // Verify playlist exists and belongs to user
        const playlist = await Playlist.findById(playlistId);
        if (!playlist) {
            console.error('Playlist not found:', playlistId);
            return res.status(404).json({ error: 'Playlist not found' });
        }
        if (playlist.user.toString() !== userId) {
            console.error('Unauthorized access to playlist:', { playlistId, userId });
            return res.status(403).json({ error: 'Not authorized to delete this playlist' });
        }

        // Remove playlist from user's playlists
        await User.updateOne({ _id: userId }, { $pull: { playlists: playlistId } });

        // Delete playlist
        await playlist.deleteOne();

        res.status(200).json({
            message: 'Playlist deleted successfully',
        });
    } catch (error) {
        console.error('Delete playlist error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

module.exports = {
    createPlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    getPlaylist,
    getUserPlaylists,
    getPublicUserPlaylists,
    updatePlaylist,
    deletePlaylist,
};