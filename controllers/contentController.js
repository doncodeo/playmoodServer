const asyncHandler = require('express-async-handler');
const contentSchema = require('../models/contentModel');
const userSchema = require('../models/userModel');
const cloudinary = require('../config/cloudinary');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose'); // Add mongoose import
const fs = require('fs');
const { setEtagAndCache } = require('../utils/responseHelpers');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
    }
});

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

    res.status(200).json(content);
});

// @desc Create Content
// @route POST /api/content
// @access Private 

const createContent = asyncHandler(async (req, res) => {
    try {
        const { title, category, description, credit, userId, previewStart, previewEnd } = req.body;

        // Validate required fields
        if (!title || !category || !description || !credit || !userId) {
            return res.status(400).json({ error: 'Important fields missing!' });
        }

        // Validate preview timeline
        const start = parseFloat(previewStart); 
        const end = parseFloat(previewEnd);
        if (isNaN(start) || isNaN(end)) {
            return res.status(400).json({ error: 'Preview start and end times are required!' });
        }
        if (end - start !== 10) {
            return res.status(400).json({ error: 'Preview segment must be exactly 10 seconds!' });
        }
        if (start < 0) {
            return res.status(400).json({ error: 'Preview start time cannot be negative!' });
        }

        // Validate files
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'At least a video file is required!' });
        }

        let videoFile, thumbnailFile;

        // Separate video and thumbnail files based on MIME type
        req.files.forEach(file => {
            if (file.mimetype.toLowerCase().startsWith('video/')) {
                videoFile = file;
            } else if (file.mimetype.toLowerCase().startsWith('image/')) {
                thumbnailFile = file;
            }
        });

        if (!videoFile) {
            return res.status(400).json({ error: 'Video file is required!' });
        }

        // Upload video to Cloudinary first
        const videoResult = await cloudinary.uploader.upload(videoFile.path, {
            resource_type: 'video',
            folder: 'videos',
            eager: [{
                width: 1280,
                height: 720,
                crop: 'fill',
                gravity: 'auto',
                format: 'jpg',
                start_offset: '2',
            }],
        });

        // Clean up video file immediately after upload
        try {
            fs.unlinkSync(videoFile.path);
        } catch (cleanupError) {
            console.warn('Failed to delete video temp file:', cleanupError.message);
        }

        // Fetch video metadata to get duration
        let videoDuration = Infinity; // Default to allow preview if metadata fetch fails
        try {
            const videoInfo = await cloudinary.api.resource(videoResult.public_id, {
                resource_type: 'video',
            });
            videoDuration = videoInfo.duration; // Duration in seconds
            console.log(`Video duration: ${videoDuration}s`);
        } catch (metadataError) {
            console.warn('Failed to fetch video metadata:', metadataError.message);
            // Proceed without duration validation to avoid blocking upload
        }

        // Validate preview timeline against video duration
        if (end > videoDuration) {
            return res.status(400).json({
                error: `Preview end time (${end}s) exceeds video duration (${videoDuration}s)!`,
            });
        }

        let thumbnailUrl = '';
        let cloudinaryThumbnailId = '';

        // Upload manual thumbnail if provided
        if (thumbnailFile) {
            const thumbnailResult = await cloudinary.uploader.upload(thumbnailFile.path, {
                folder: 'thumbnails',
                transformation: [
                    { width: 1280, height: 720, crop: 'fill', gravity: 'auto' },
                ],
            });
            try {
                fs.unlinkSync(thumbnailFile.path);
            } catch (cleanupError) {
                console.warn('Failed to delete thumbnail temp file:', cleanupError.message);
            }
            thumbnailUrl = thumbnailResult.secure_url;
            cloudinaryThumbnailId = thumbnailResult.public_id;
        } else {
            thumbnailUrl = videoResult.eager?.[0]?.secure_url || '';
        }

        // Validate user
        const user = await userSchema.findById(userId);
        if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
            return res.status(403).json({ error: 'Unauthorized to create content' });
        }
        if (userId !== req.user.id) {
            return res.status(403).json({ error: 'Cannot create content for another user!' });
        }

        const isApproved = user.role === 'admin';

        // Create content with preview timeline
        const content = await contentSchema.create({
            user: userId,
            title,
            category,
            description,
            credit,
            thumbnail: thumbnailUrl,
            video: videoResult.secure_url,
            cloudinary_video_id: videoResult.public_id,
            cloudinary_thumbnail_id: cloudinaryThumbnailId,
            shortPreview: { start, end },
            isApproved,
        });

        // Generate preview URL
        const previewUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_${start},eo_${end}/${videoResult.public_id}.mp4`;

        // Send email to admins if not approved
        if (!isApproved) {
            const admins = await userSchema.find({ role: 'admin' });
            admins.forEach(admin => {
                const mailOptions = {
                    from: `"PlaymoodTV 📺" <${process.env.EMAIL_USERNAME}>`,
                    to: admin.email,
                    subject: 'New Content Approval Request',
                    html: `
                        <html>
                            <head>
                                <style>
                                    body { font-family: Arial, sans-serif; background-color: #f0f0f0; color: #333; padding: 20px; }
                                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); }
                                    .header { background-color: tomato; color: white; padding: 10px; text-align: center; border-top-left-radius: 8px; border-top-right-radius: 8px; }
                                    .content { padding: 20px; }
                                    .approve-button { display: inline-block; padding: 10px 20px; background-color: tomato; color: white; text-decoration: none; border-radius: 5px; }
                                    .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="header">
                                        <h2>New Content Approval Request</h2>
                                    </div>
                                    <div class="content">
                                        <p>Dear ${admin.name},</p>
                                        <p>A new content titled "${title}" has been created and requires your approval.</p>
                                        <p>Preview: <a href="${previewUrl}" target="_blank">View 10-second Preview</a></p>
                                        <p>Please use the following button to approve the content:</p>
                                        <a class="approve-button" href="${process.env.APP_URL}/admin/approve-content/${content._id}" target="_blank">Approve Content</a>
                                        <p>Thank you for your attention.</p>
                                    </div>
                                    <div class="footer">
                                        <p>Best regards,</p>
                                        <p>The PlaymoodTV Team</p>
                                    </div>
                                </div>
                            </body>
                        </html>
                    `,
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error sending email:', error);
                    } else {
                        console.log('Email sent:', info.response);
                    }
                });
            });
        }

        res.status(201).json({
            ...content._doc,
            previewUrl,
        });
    } catch (error) {
        // Clean up temporary files in case of error
        if (req.files) {
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                } catch (cleanupError) {
                    console.warn('Failed to delete temporary file:', cleanupError.message);
                }
            });
        }
        console.error('Create content error:', JSON.stringify(error, null, 2));
        res.status(500).json({ error: 'Server error', details: error.message });
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

        content.isApproved = true;
        content.rejectionReason = undefined; // Clear rejection reason
        await content.save();

        // Populate user details
        const populatedContent = await contentSchema.findById(id).populate('user', 'name profileImage');

        res.status(200).json({
            message: 'Content approved successfully',
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

        if (req.file) {
            const updatedCloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
                folder: 'contents',
                public_id: content.cloudinary_thumbnail_id, // Use thumbnail ID
            });

            await cloudinary.uploader.destroy(content.cloudinary_thumbnail_id);
            content.thumbnail = updatedCloudinaryResult.secure_url;
            content.cloudinary_thumbnail_id = updatedCloudinaryResult.public_id;
        }

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

module.exports = {
    getContent,
    getRecentContent,
    getRecentCreatorContent,
    getContentById,
    createContent,
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
};

