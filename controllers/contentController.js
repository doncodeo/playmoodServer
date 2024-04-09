
const asyncHandler = require ('express-async-handler');
const contentSchema = require('../models/contentModel');
const userSchema = require('../models/userModel')
const cloudinary = require('../config/cloudinary');

const Test = "Working Here"



// @desc Get Content
// @route GET /api/content
// @access Private

const getContent = asyncHandler(async (req, res) => {
    console.log('Fetching content...');
    const content = await contentSchema.find().populate('user', 'name');;
    // console.log('Fetched content:', content);
    res.status(200).json(content);
});


// @desc Post Content
// @route POST /api/content

const createContent = asyncHandler(async (req, res) => {
    try {
        const { title, category, description, credit, userId } = req.body;
        // const userId = req.user._id;

        // Check if required fields are missing
        if (!title || !category || !description || !credit || !userId) {
            return res.status(400).json({ error: 'Important fields missing!' });
        }

        // Check if both video and thumbnail files are uploaded
        if (!req.files || req.files.length !== 2) {
            return res.status(400).json({ error: 'Both video and thumbnail files are required!' });
        }

        // Extract uploaded files
        const [videoFile, thumbnailFile] = req.files;

        // Upload video to Cloudinary
        const videoResult = await cloudinary.uploader.upload(videoFile.path, {
            resource_type: 'video',
            folder: "videos"
        });

        // Upload thumbnail to Cloudinary
        const thumbnailResult = await cloudinary.uploader.upload(thumbnailFile.path, {
            folder: "thumbnails"
        });

        // Create content
        const content = await contentSchema.create({
            user: userId,
            title,
            category,
            description,
            credit,
            thumbnail: thumbnailResult.secure_url,
            video: videoResult.secure_url,
            cloudinary_video_id: videoResult.public_id,
            cloudinary_thumbnail_id: thumbnailResult.public_id
        });

        res.status(201).json({
            _id: content._id,
            title: content.title,
            category: content.category,
            description: content.description,   
            thumbnail: content.thumbnail,
            video: content.video,
            credit: content.credit,
            cloudinary_id: content.cloudinary_video_id,
            thumbnail_id: content.cloudinary_thumbnail_id,
            user: content.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
})



// @desc Post Content
// @route POST /api/content/:id

const updateContent = asyncHandler(async (req, res) => {
    try {
        const contentId = req.params.id; // Assuming the user ID is passed as a parameter

        // Fetch the user from MongoDB
        const content = await contentSchema.findById(contentId);

        if (!content) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Update the thumbnail in Cloudinary
        const updatedCloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
            folder: 'contents',
            public_id: content._id, // Set public_id to a unique identifier like user._id
        });

        console.log(updatedCloudinaryResult)

        // If updating the thumbnail, delete the old thumbnail in Cloudinary
        if (content.cloudinary_id) {
            await cloudinary.uploader.destroy(content.cloudinary_id);

              // Update the user's profileImage and cloudinary_id
              content.thumbnail = updatedCloudinaryResult.secure_url;
              content.cloudinary_id = updatedCloudinaryResult.public_id;
        }

        // Update user data in MongoDB
        content.title = req.body.name || content.title;
        content.category = req.body.category || content.category;
        content.description = req.body.description || content.description;
        content.credit = req.body.credit || content.credit;
        content.thumbnail = req.body.thumbnail || content.thumbnail;
        content.video = req.body.video || content.video;
        content.likes = req.body.likes || content.likes;
        content.cloudinary_id = updatedCloudinaryResult.public_id;

        // Save the updated content in MongoDB
        const updatedContent = await content.save();

        res.status(200).json({
            message: 'content updated successfully',
            content: {
                _id: updatedContent._id,
                title: updatedContent.name,
                category: updatedContent.category,
                description: updatedContent.description,
                credit: updatedContent.credit,
                thumbnail: updatedContent.thumbnail,
                video: updatedContent.video,
                likes: updatedContent.likes,
                cloudinary_id: updatedContent.cloudinary_id, // Update the cloudinary_id
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});



// @desc Delete content
// @route DELETE /api/content/:id

const deleteContent = async (req, res) => {
    try {
        const { id } = req.params;

        // Find content by id
        const content = await contentSchema.findById(id);
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Check if public_ids exist
        if (!content.cloudinary_video_id || !content.cloudinary_thumbnail_id) {
            return res.status(400).json({ error: 'Missing cloudinary public_ids' });
        }

        // Delete content from MongoDB
        await contentSchema.findByIdAndDelete(id);

        // Delete thumbnail and video from Cloudinary
        await cloudinary.uploader.destroy(content.cloudinary_video_id);
        await cloudinary.uploader.destroy(content.cloudinary_thumbnail_id);

        res.status(200).json({ message: 'Content deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};


 module.exports = {
    getContent,
    updateContent,
    createContent,
    deleteContent,
 }
