const asyncHandler = require('express-async-handler');
const contentSchema = require('../models/contentModel');
const userSchema = require('../models/userModel');
const cloudinary = require('../config/cloudinary');


// @desc Get All Content
// @route GET /api/content
// @access Private
const getContent = asyncHandler(async (req, res) => {
    const content = await contentSchema.find({ isApproved: true }).populate('user', 'name');
    // const content = await contentSchema.find().populate('user', 'name');
    res.status(200).json(content);
});

// @desc Get All Unapproved Content
// @route GET /api/content/unapproved
// @access Private (Admin only)
const getUnapprovedContent = asyncHandler(async (req, res) => {
    try {
        const content = await contentSchema.find({ isApproved: false }).populate('user', 'name');
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
    const content = await contentSchema.findById(id).populate('user', 'name');

    if (!content) {
        return res.status(404).json({ error: 'Content not found' });
    }

    res.status(200).json(content);
});

// @desc Create Content
// @route POST /api/content
// @access Private

const createContent = asyncHandler(async (req, res) => {
    try {
        const { title, category, description, credit, userId } = req.body;

        if (!title || !category || !description || !credit || !userId) {
            return res.status(400).json({ error: 'Important fields missing!' });
        }

        if (!req.files || req.files.length !== 2) {
            return res.status(400).json({ error: 'Both video and thumbnail files are required!' });
        }

        const [videoFile, thumbnailFile] = req.files;

        const videoResult = await cloudinary.uploader.upload(videoFile.path, {
            resource_type: 'video',
            folder: "videos"
        });

        const thumbnailResult = await cloudinary.uploader.upload(thumbnailFile.path, {
            folder: "thumbnails"
        });

        const user = await userSchema.findById(userId);

        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        const isApproved = user.role === 'admin';

        const content = await contentSchema.create({
            user: userId,
            title,
            category,
            description,
            credit,
            thumbnail: thumbnailResult.secure_url,
            video: videoResult.secure_url,
            cloudinary_video_id: videoResult.public_id,
            cloudinary_thumbnail_id: thumbnailResult.public_id,
            isApproved
        });

        res.status(201).json(content);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc Approve Content
// @route PUT /api/content/approve/:id
// @access Private (Admin only)
const approveContent = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        // Find the content by ID
        const content = await contentSchema.findById(id);

        // Check if content exists
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Update the isApproved field to true
        content.isApproved = true;

        // Save the updated content
        await content.save();

        res.status(200).json({ message: 'Content approved successfully', content });
    } catch (error) {
        console.error(`Error approving content: ${error.message}`);
        res.status(500).json({ error: 'Server error, please try again later' });
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
                public_id: content.cloudinary_id,
            });

            await cloudinary.uploader.destroy(content.cloudinary_id);
            content.thumbnail = updatedCloudinaryResult.secure_url;
            content.cloudinary_id = updatedCloudinaryResult.public_id;
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

module.exports = {
    getContent,
    getContentById,
    createContent,
    updateContent,
    deleteContent,
    approveContent,
    getUnapprovedContent
};

