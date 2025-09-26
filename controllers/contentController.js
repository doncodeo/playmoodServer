const asyncHandler = require('express-async-handler');
const contentSchema = require('../models/contentModel');
const Highlight = require('../models/highlightModel');
const userSchema = require('../models/userModel');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose'); // Add mongoose import
const fs = require('fs');
const { setEtagAndCache } = require('../utils/responseHelpers');
const { compressVideo } = require('../utils/videoCompressor');
const aiService = require('../ai/ai-service');
const path = require('path');
const uploadQueue = require('../config/queue');
const { getWss } = require('../websocket');
const WebSocket = require('ws');

// @desc Get All Content
// @route GET /api/content 
// @access Private
const getContent = asyncHandler(async (req, res) => {
    const content = await contentSchema.find({ isApproved: true }).populate('user', 'name').lean();
    const lastUpdated = content.length > 0 ? Math.max(...content.map(c => c.updatedAt.getTime())) : 0;
    const etag = `"all-${content.length}-${lastUpdated}"`;

    if (req.get('If-None-Match') === etag) return res.status(304).end();

    setEtagAndCache(res, etag, 900);
    res.status(200).json(content);
});

// @desc Get Recent Content (last 10)
// @route GET /api/content/new
// @access Private
const getRecentContent = asyncHandler(async (req, res) => {
    try {
        const recentContents = await contentSchema.find({ isApproved: true })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('user', 'name');

        // Generate an ETag based on recent content
        const lastCreated = recentContents.length > 0 ? recentContents[0].createdAt.getTime() : 0;
        const etag = `"recent-${recentContents.length}-${lastCreated}"`;

        if (req.get('If-None-Match') === etag) {
            return res.status(304).end();
        }

        res.set({
            'Cache-Control': 'private, max-age=900', // Cache for 15 minutes
            'ETag': etag,
        });

        res.status(200).json(recentContents);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc Get Top 10 Content
// @route GET /api/content/top-ten
// @access Private
const getTopTenContent = asyncHandler(async (req, res) => {
    try {
        const topContents = await contentSchema.find({ isApproved: true })
            .sort({ views: -1 })
            .limit(10)
            .populate('user', 'name')
            .lean();

        const lastUpdated = topContents.length > 0 ? Math.max(...topContents.map(c => c.updatedAt.getTime())) : 0;
        const etag = `"top-10-${topContents.length}-${lastUpdated}"`;

        if (req.get('If-None-Match') === etag) {
            return res.status(304).end();
        }

        setEtagAndCache(res, etag, 900); // Cache for 15 minutes
        res.status(200).json(topContents);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc Get Recommended Content
// @route GET /api/content/recommended/:id
// @access Private
const getRecommendedContent = asyncHandler(async (req, res) => {
    try {
        const content = await contentSchema.findById(req.params.id);

        if (!content || !content.contentEmbedding || content.contentEmbedding.length === 0) {
            return res.status(404).json({ error: 'Content not found or does not have an embedding for recommendations.' });
        }

        // This is a simplified cosine similarity calculation.
        // For production, a dedicated vector database would be more efficient.
        const allContent = await contentSchema.find({
            isApproved: true,
            _id: { $ne: req.params.id },
            contentEmbedding: { $exists: true, $ne: [] }
        }).lean();

        const recommendedContents = allContent.map(otherContent => {
            const similarity = cosineSimilarity(content.contentEmbedding, otherContent.contentEmbedding);
            return { ...otherContent, similarity };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10); // Get top 10 recommendations

        res.status(200).json(recommendedContents);
    } catch (error) {
        console.error('Error getting recommended content:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// @desc    Get the most recent approved content for a specific creator
// @route   GET /api/content/creator/:userId/recent
// @access  Public
const getRecentCreatorContent = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    console.log('Requested creator userId:', userId); // Debug

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid userId format:', userId);
        return res.status(400).json({ error: 'Invalid creator ID format' });
    }

    try {
        // Verify user exists and is a creator
        const user = await userSchema.findById(userId).select('name role');
        if (!user) {
            console.error('User not found for ID:', userId);
            return res.status(404).json({ error: 'Creator not found' });
        }
        if (user.role !== 'creator') {
            console.error('User is not a creator:', userId);
            return res.status(400).json({ error: 'User is not a creator' });
        }

        // Fetch the most recent approved content
        const recentContent = await contentSchema.findOne({
            user: userId,
            isApproved: true,
        })
            .sort({ createdAt: -1 })
            .populate('user', 'name')
            .populate({
                path: 'comments.user',
                select: 'name profileImage',
            });

        // Generate ETag
        const lastCreated = recentContent ? recentContent.createdAt.getTime() : 0;
        const etag = `"creator-recent-${userId}-${lastCreated}"`;

        if (req.get('If-None-Match') === etag) {
            return res.status(304).end();
        }

        res.set({
            'Cache-Control': 'private, max-age=900', // Cache for 15 minutes
            'ETag': etag,
        });

        res.status(200).json({
            message: recentContent ? 'Most recent creator content retrieved successfully' : 'No approved content found for this creator',
            content: recentContent || null,
        });
    } catch (error) {
        console.error('Get most recent creator content error:', {
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



// @desc Get All Unapproved Content
// @route GET /api/content/unapproved
// @access Private (Admin only)
const getUnapprovedContent = asyncHandler(async (req, res) => {
    try {
        const content = await contentSchema.find({ isApproved: false }).populate('user', 'name');

        // Generate an ETag based on unapproved content
        const lastUpdated = content.length > 0 ? Math.max(...content.map(c => c.updatedAt.getTime())) : 0;
        const etag = `"unapproved-${content.length}-${lastUpdated}"`;

        if (req.get('If-None-Match') === etag) {
            return res.status(304).end();
        }

        res.set({
            'Cache-Control': 'private, max-age=300', // Cache for 5 minutes (more volatile)
            'ETag': etag,
        });

        res.status(200).json(content);
    } catch (error) {
        console.error(`Error fetching unapproved content: ${error.message}`);
        res.status(500).json({ error: 'Server error, please try again later' });
    }
});

// @desc Get Content by ID
// @route GET /api/content/:id
// @access Private
const getContentById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user ? req.user._id : null;
    const viewerIP = req.ip;

    const content = await contentSchema.findById(id).populate('user', 'name');
    if (!content) {
        return res.status(404).json({ error: 'Content not found' });
    }

    // Check if the viewer has already viewed this content
    const hasViewed = (userId && content.viewers.some(viewer => viewer.toString() === userId.toString())) ||
                      content.viewerIPs.includes(viewerIP);

    if (!hasViewed) {
        content.views += 1;
        if (userId) {
            content.viewers.push(userId);
        } else {
            content.viewerIPs.push(viewerIP);
        }
        await content.save();
    }

    // Generate an ETag based on content ID and last update
    const etag = `"${id}-${content.updatedAt.getTime()}"`;

    if (req.get('If-None-Match') === etag) {
        return res.status(304).end();
    }

    res.set({
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour (individual content is fairly static)
        'ETag': etag,
    });

    const contentData = content.toObject();
    if (content.highlight) {
        const highlight = await Highlight.findById(content.highlight);
        if (highlight) {
            contentData.highlight = highlight.toObject();
            contentData.highlightUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_${highlight.startTime},eo_${highlight.endTime}/${content.cloudinary_video_id}.mp4`;
        }
    }

    res.status(200).json(contentData);
});

// @desc Create Content
// @route POST /api/content
// @access Private 
const createContent = asyncHandler(async (req, res) => {
    try {
        // The file data now comes from the client after a direct upload to Cloudinary
        const { title, category, description, credit, previewStart, previewEnd, languageCode, video, thumbnail } = req.body;
        const userId = req.user.id; // Use the authenticated user's ID

        // 1. Initial Validation
        if (!title || !category || !description || !credit || !video) {
            return res.status(400).json({ error: 'Important fields, including video data, are missing!' });
        }
        if (!video.public_id || !video.url) {
            return res.status(400).json({ error: 'Video data must include a public_id and a url.' });
        }
        const start = parseFloat(previewStart);
        const end = parseFloat(previewEnd);
        if (isNaN(start) || isNaN(end) || end - start !== 10 || start < 0) {
            return res.status(400).json({ error: 'Invalid preview timeline. Must be a 10-second segment.' });
        }

        // 2. Validate user
        const user = await userSchema.findById(userId);
        if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
            return res.status(403).json({ error: 'Unauthorized to create content' });
        }

        // 3. Create initial content document with 'completed' status and final URLs
        let thumbnailUrl = thumbnail ? thumbnail.url : `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_2/${video.public_id}.jpg`;
        let thumbnailPublicId = thumbnail ? thumbnail.public_id : ''; // May be empty

        const content = await contentSchema.create({
            user: userId,
            title,
            category,
            description,
            credit,
            shortPreview: { start, end },
            status: 'completed', // Set status to completed immediately
            video: video.url,
            cloudinary_video_id: video.public_id,
            thumbnail: thumbnailUrl,
            cloudinary_thumbnail_id: thumbnailPublicId,
            isApproved: user.role === 'admin', // Admins' content is auto-approved
            aiModerationStatus: 'processing', // Set AI moderation status
        });

        // 4. Construct job data for the worker
        const jobData = {
            contentId: content._id,
            languageCode,
            video: {
                url: video.url,
                public_id: video.public_id,
            },
            thumbnail: thumbnail ? {
                url: thumbnail.url,
                public_id: thumbnail.public_id,
            } : null,
        };

        // 5. Add the job to the queue
        await uploadQueue.add('process-upload', jobData);

        // 6. Respond to the user immediately
        return res.status(202).json({
            message: 'Upload received and is being processed. You will be notified upon completion.',
            contentId: content._id,
            status: 'processing'
        });

    } catch (error) {
        console.error('Create content initial error:', error);
        res.status(500).json({ error: 'Server error during upload initiation.', details: error.message });
    }
});

// @desc    Generate a signature for direct client-side uploads
// @route   POST /api/content/signature
// @access  Private
const generateUploadSignature = asyncHandler(async (req, res) => {
    try {
        const { type } = req.body;
        const userId = req.user.id;

        // The 'type' parameter is expected from the client to specify the upload folder.
        if (!type || !['videos', 'images'].includes(type)) {
            return res.status(400).json({ error: "Request must include a 'type' property, which can be 'videos' or 'images'." });
        }

        const folder = `user-uploads/${userId}/${type}`;
        const timestamp = Math.round((new Date).getTime() / 1000);

        // Parameters to sign
        const params_to_sign = {
            timestamp: timestamp,
            folder: folder,
        };

        const signature = cloudinary.utils.api_sign_request(params_to_sign, process.env.CLOUDINARY_API_SECRET);

        // Respond with the signature and other necessary data
        res.status(200).json({
            signature,
            timestamp,
            folder,
            api_key: process.env.CLOUDINARY_API_KEY,
        });
    } catch (error) {
        console.error('Error generating Cloudinary signature:', error);
        res.status(500).json({ error: 'Server error while generating upload signature.' });
    }
});

// Add a comment to content
const addComment = asyncHandler(async (req, res) => {
    try {
        const { contentId, text } = req.body;
        const userId = req.user.id; // From protect middleware

        // Validate input
        if (!contentId || !text) {
            return res.status(400).json({ error: 'Content ID and comment text are required!' });
        }
        if (typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({ error: 'Comment text cannot be empty!' });
        }
        if (text.length > 1000) {
            return res.status(400).json({ error: 'Comment cannot exceed 1000 characters!' });
        }

        // Moderate comment
        const moderationResult = await aiService.moderateComment(text);
        if (moderationResult.status !== 'approved') {
            return res.status(400).json({ error: 'Comment cannot be posted as it violates our community guidelines.' });
        }

        // Validate content exists
        const content = await contentSchema.findById(contentId);
        if (!content) {
            return res.status(404).json({ error: 'Content not found!' });
        }

        // Validate user exists
        const user = await userSchema.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found!' });
        }

        // Add comment to content
        const newComment = {
            user: userId,
            text: text.trim(),
            createdAt: new Date(),
        };
        content.comments.push(newComment);
        await content.save();

        // Populate user details for the new comment
        const updatedContent = await contentSchema
            .findById(contentId)
            .populate({
                path: 'comments.user',
                select: 'name profileImage', // Include user name and image
            });

        // Get the newly added comment
        const addedComment = updatedContent.comments[updatedContent.comments.length - 1];

        res.status(201).json({
            message: 'Comment added successfully!',
            comment: addedComment,
        });
    } catch (error) {
        console.error('Add comment error:', JSON.stringify(error, null, 2));
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// @desc    Get comments for a content item
// @route   GET /api/content/:id/comments
// @access  Public (or Private, add protect middleware if needed)
const getComments = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query; // Pagination parameters

        // Validate content ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid content ID format' });
        }

        // Find content and populate comments
        const content = await contentSchema.findById(id).populate({
            path: 'comments.user',
            select: 'name profileImage',
        });

        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Optional: Restrict comments to approved content
        // if (!content.isApproved) {
        //     return res.status(403).json({ error: 'Comments are only available for approved content' });
        // }

        // Paginate comments
        const comments = content.comments;
        const totalComments = comments.length;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedComments = comments.slice(startIndex, endIndex);

        res.status(200).json({
            message: 'Comments retrieved successfully',
            totalComments,
            page: parseInt(page),
            limit: parseInt(limit),
            comments: paginatedComments,
        });
    } catch (error) {
        console.error('Get comments error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid content ID', details: error.message });
        }
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

// @desc    Approve Content
// @route   PUT /api/content/approve/:id
// @access  Private (Admin only)
const approveContent = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    console.log('Approving content:', { id, userId: user.id }); // Debug

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.error('Invalid content ID:', id);
        return res.status(400).json({ error: 'Invalid content ID format' });
    }

    // Check admin role
    if (user.role !== 'admin') {
        console.error('Unauthorized access - not admin:', user.id);
        return res.status(403).json({ error: 'Admin access required' });
    }

    try {
        const content = await contentSchema.findById(id);
        if (!content) {
            console.error('Content not found:', id);
            return res.status(404).json({ error: 'Content not found' });
        }

        // Update content fields from request body if they exist
        const { title, category, description, credit } = req.body;
        if (title) content.title = title;
        if (category) content.category = category;
        if (description) content.description = description;
        if (credit) content.credit = credit;

        content.isApproved = true;
        content.rejectionReason = undefined; // Clear rejection reason
        await content.save();

        // Populate user details
        const populatedContent = await contentSchema.findById(id).populate('user', 'name profileImage');

        // Notify clients via WebSocket
        const wss = getWss();
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    event: 'content_approved',
                    payload: populatedContent,
                }));
            }
        });

        res.status(200).json({
            message: 'Content approved and updated successfully',
            content: populatedContent,
        });
    } catch (error) {
        console.error('Approve content error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        if (error.name === 'MulterError') {
            return res.status(400).json({ error: 'Unexpected file upload detected', details: error.message });
        }
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid data detected', details: error.message });
        }
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

// @desc    Reject Content
// @route   PUT /api/content/reject/:id
// @access  Private (Admin only)
const rejectContent = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const user = req.user;

    console.log('Rejecting content:', { id, userId: user.id, rejectionReason }); // Debug

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.error('Invalid content ID:', id);
        return res.status(400).json({ error: 'Invalid content ID format' });
    }

    // Validate rejection reason
    if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0) {
        console.error('Invalid rejection reason:', rejectionReason);
        return res.status(400).json({ error: 'Rejection reason is required and must be a non-empty string' });
    }
    if (rejectionReason.length > 500) {
        console.error('Rejection reason too long:', rejectionReason.length);
        return res.status(400).json({ error: 'Rejection reason cannot exceed 500 characters' });
    }

    // Check admin role
    if (user.role !== 'admin') {
        console.error('Unauthorized access - not admin:', user.id);
        return res.status(403).json({ error: 'Admin access required' });
    }

    try {
        const content = await contentSchema.findById(id);
        if (!content) {
            console.error('Content not found:', id);
            return res.status(404).json({ error: 'Content not found' });
        }

        content.isApproved = false;
        content.rejectionReason = rejectionReason.trim();
        await content.save();

        // Populate user details
        const populatedContent = await contentSchema.findById(id).populate('user', 'name profileImage');

        // Notify clients via WebSocket
        const wss = getWss();
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    event: 'content_rejected',
                    payload: populatedContent,
                }));
            }
        });

        res.status(200).json({
            message: 'Content rejected successfully',
            content: populatedContent,
        });
    } catch (error) {
        console.error('Reject content error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        if (error.name === 'MulterError') {
            return res.status(400).json({ error: 'Unexpected file upload detected', details: error.message });
        }
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid data detected', details: error.message });
        }
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});


// @desc Update Content 
// @route PUT /api/content/:id
// @access Private
const updateContent = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { title, category, description, credit, thumbnail, video, likes } = req.body;
        
        let content = await contentSchema.findById(id);
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // The thumbnail is now updated by providing a new URL in the request body.
        // The direct upload flow applies to new content, not thumbnail updates in this function.
        // For simplicity, we assume the client provides a new URL for the thumbnail if it needs changing.
        // A more advanced implementation might involve a separate signature endpoint for thumbnail updates.

        content.title = title || content.title;
        content.category = category || content.category;
        content.description = description || content.description;
        content.credit = credit || content.credit;
        content.thumbnail = thumbnail || content.thumbnail;
        content.video = video || content.video;
        content.likes = likes || content.likes;

        const updatedContent = await content.save();
        res.status(200).json(updatedContent);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc Delete Content
// @route DELETE /api/content/:id
// @access Private
const deleteContent = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        const content = await contentSchema.findById(id);
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        if (content.cloudinary_video_id) {
            await cloudinary.uploader.destroy(content.cloudinary_video_id);
        }

        if (content.cloudinary_thumbnail_id) {
            await cloudinary.uploader.destroy(content.cloudinary_thumbnail_id);
        }

        await contentSchema.findByIdAndDelete(id);
        res.status(200).json({ message: 'Content deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});


// @desc    Update video progress
// @route   POST /api/content/progress/:contentId
// @access  Private
const saveVideoProgress = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { contentId } = req.params;
    const { progress } = req.body; // Progress in seconds

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return res.status(400).json({ error: 'Invalid content ID format' });
    }
    if (typeof progress !== 'number' || progress < 0) {
        return res.status(400).json({ error: 'Invalid progress value' });
    }

    try {
        const user = await userData.findById(userId);
        const content = await require('../models/contentModel').findById(contentId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Find or create progress record
        const existingRecord = user.videoProgress.find(record =>
            record.contentId.equals(contentId)
        );

        if (existingRecord) {
            existingRecord.progress = progress;
        } else {
            user.videoProgress.push({ contentId, progress });
        }

        await user.save();

        res.status(200).json({
            message: 'Video progress updated successfully',
            progress,
            contentId,
        });
    } catch (error) {
        console.error('Update video progress error:', JSON.stringify(error, null, 2));
        res.status(500).json({ error: 'Server error', details: error.message });
    }
})

// @desc Get Video Progress
// @route GET /api/content/progress/:contentId
// @access Private
const getVideoProgress = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { contentId } = req.params;

    if (!contentId) {
        return res.status(400).json({ error: 'Content ID is required' });
    }

    const user = await userSchema.findById(userId).populate('videoProgress.contentId');
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const progressRecord = user.videoProgress.find(
        record => record.contentId._id.toString() === contentId.toString()
    );

    const progress = progressRecord ? progressRecord.progress : 0;

    // Generate an ETag based on user ID and content ID
    const etag = `"progress-${userId}-${contentId}-${progress}"`;

    if (req.get('If-None-Match') === etag) {
        return res.status(304).end();
    }

    res.set({
        'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
        'ETag': etag,
    });

    res.status(200).json({ progress });
});

// @desc    Get all videos in user's continue watching list
// @route   GET /api/content/continue-watching
// @access  Private
const ContinueWatching = asyncHandler(async (req, res) => {
    const userId = req.user.id; // Use id instead of _id for consistency

    console.log('Authenticated userId:', userId); // Debug

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid userId format:', userId);
        return res.status(400).json({ error: 'Invalid user ID format' });
    }

    try {
        // Fetch user with populated videoProgress
        const user = await userSchema.findById(userId).populate({
            path: 'videoProgress.contentId',
            select: 'title category description thumbnail video videoPreviewUrl duration views likes createdAt',
            match: { isApproved: true }, // Optional: Only approved content
        });

        if (!user) {
            console.error('User not found for ID:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        // Filter videos with progress > 0 and valid content
        const continueWatching = user.videoProgress
            .filter(record => record.progress > 0 && record.contentId) // Exclude zero progress or invalid content
            .map(record => ({
                contentId: record.contentId._id,
                title: record.contentId.title,
                category: record.contentId.category,
                description: record.contentId.description,
                thumbnail: record.contentId.thumbnail,
                video: record.contentId.video,
                videoPreviewUrl: record.contentId.videoPreviewUrl,
                duration: record.contentId.duration,
                views: record.contentId.views,
                likes: record.contentId.likes,
                createdAt: record.contentId.createdAt,
                progress: record.progress,
            }))
            .sort((a, b) => b.createdAt - a.createdAt); // Sort by creation date

        console.log('Continue watching count:', continueWatching.length); // Debug

        // Generate ETag
        const etag = `"continue-watching-${userId}-${JSON.stringify(continueWatching.map(v => `${v.contentId}-${v.progress}`))}"`;

        if (req.get('If-None-Match') === etag) {
            return res.status(304).end();
        }

        res.set({
            'Cache-Control': 'private, max-age=300',
            'ETag': etag,
        });

        res.status(200).json({
            message: 'Continue watching list retrieved successfully',
            continueWatching,
        });
    } catch (error) {
        console.error('Continue watching error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid video progress entry detected', details: error.message });
        }
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

// @desc PUT Content
// @route PUT /api/user/watchlist/:id (user id) push the content id  {"contentId": "65a6fc7b72128447ad32024e", "userId": "65a8025e3af4e7929b379e7b"}

const addWatchlist = asyncHandler(async (req, res) => {
    try {
        const { contentId } = req.body;
        const userId = req.user.id;
        console.log(userId)
        console.log(contentId)

        // Check if content exists
        const content = await contentSchema.findById(contentId);
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Check if the user has already liked the content
        const user = await userSchema.findOne({ _id: userId, watchlist: contentId });
 
        if (user) {
            return res.status(400).json({ error: 'This content already exist on users watchlist' });
        }

        // Find the user by ID and update the likes array
        const updatedUser = await userSchema.findByIdAndUpdate(
            userId,
            { $push: { watchlist: contentId } },
            { new: true }
        );

        res.status(200).json({ watchlist: updatedUser.watchlist, message: "Content successfully added to Watchlist" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc    Get watchlist for authenticated user
// @route   GET /api/users/watchlist
// @access  Private
const getWatchlist = asyncHandler(async (req, res) => {
    const userId = req.user.id; // From protect middleware

    console.log('Authenticated user ID for getWatchlist:', userId); // Debug

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid userId format in getWatchlist:', userId);
        return res.status(400).json({ error: 'Invalid user ID format' });
    }

    try {
        const user = await userSchema.findById(userId).populate({
            path: 'watchlist',
            select: 'title category description thumbnail video shortPreview previewUrl isApproved comments',
            match: { isApproved: true }, // Optional: Only approved content
            populate: {
                path: 'comments.user',
                select: 'name profileImage',
            },
        });

        if (!user) {
            console.error('User not found for ID in getWatchlist:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('User watchlist in getWatchlist:', user.watchlist ? user.watchlist.length : 'No watchlist items'); // Debug

        res.status(200).json({
            watchList: user.watchlist || [], // Return empty array if no watchlist items
        });
    } catch (error) {
        console.error('Get watchlist error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
            error: JSON.stringify(error, null, 2),
        });
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid watchlist entry detected', details: error.message });
        }
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});


// @desc PUT Content
// @route PUT /api/user/removelist/:id
const removeWatchlist = asyncHandler(async (req, res) => {
    try {
        const { contentId } = req.body;
        const userId = req.user.id;


        // Find the user by ID and update the likes array to remove the contentId
        const updatedUser = await userSchema.findByIdAndUpdate(
            userId,
            { $pull: { watchlist: contentId } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: 'User/Content not found' });
        }

        // res.status(200).json({ watchlist: updatedUser.watchlist, message:"Content removed from watchlist!" });
        res.status(200).json({ contentId: contentId, message: "Content removed from watchlist!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

const combineVideosByIds = asyncHandler(async (req, res) => {
    const { title, category, description, credit, contentIds } = req.body;
    const userId = req.user.id;

    // 1. Validate input
    if (!title || !category || !description || !credit) {
        return res.status(400).json({ error: 'Important fields missing!' });
    }

    if (!contentIds || !Array.isArray(contentIds) || contentIds.length < 2 || contentIds.length > 5) {
        return res.status(400).json({ error: 'Please provide between 2 and 5 content IDs.' });
    }

    // 2. Add job to the queue
    await uploadQueue.add('combine-videos', {
        contentIds,
        title,
        category,
        description,
        credit,
        userId,
    });

    // 3. Respond to the user immediately
    res.status(202).json({
        message: 'Video combination process started. You will be notified by email upon completion.'
    });
});



module.exports = {
    getContent,
    getRecentContent,
    getTopTenContent,
    getRecommendedContent,
    getRecentCreatorContent,
    getContentById,
    createContent,
    generateUploadSignature,
    addComment,
    getComments,
    updateContent,
    deleteContent,
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
}
