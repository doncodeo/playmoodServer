const asyncHandler = require('express-async-handler');
const contentSchema = require('../models/contentModel');
const userSchema = require('../models/userModel');
const cloudinary = require('../config/cloudinary');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose'); // Add mongoose import
const fs = require('fs');

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
    const content = await contentSchema.find({ isApproved: true }).populate('user', 'name'); 

    // Generate an ETag based on content length and last update
    const lastUpdated = content.length > 0 ? Math.max(...content.map(c => c.updatedAt.getTime())) : 0; 
    const etag = `"all-${content.length}-${lastUpdated}"`;
 
    // Check if the client’s ETag matches
    if (req.get('If-None-Match') === etag) {
        return res.status(304).end(); // Not Modified
    }

    // Set caching headers
    res.set({
        'Cache-Control': 'private, max-age=900', // Cache for 15 minutes
        'ETag': etag,
    });

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
        const { title, category, description, credit, userId } = req.body;

        if (!title || !category || !description || !credit || !userId) {
            return res.status(400).json({ error: 'Important fields missing!' });
        }

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

        // Upload video with eager transformation for high-quality thumbnail
        const videoResult = await cloudinary.uploader.upload(videoFile.path, {
            resource_type: 'video',
            folder: 'videos',
            eager: [{
                width: 1280,
                height: 720,
                crop: 'fill',
                gravity: 'auto',
                format: 'jpg',
                start_offset: '2' // Capture at 2 seconds
            }]
        });

        fs.unlinkSync(videoFile.path); // Remove video from temp

        let thumbnailUrl = '';
        let cloudinaryThumbnailId = '';

        // Upload manual thumbnail if provided
        if (thumbnailFile) {
            const thumbnailResult = await cloudinary.uploader.upload(thumbnailFile.path, {
                folder: 'thumbnails',
                transformation: [
                    { width: 1280, height: 720, crop: 'fill', gravity: 'auto' }
                ]
            });
            fs.unlinkSync(thumbnailFile.path); // Clean up local file
            thumbnailUrl = thumbnailResult.secure_url;
            cloudinaryThumbnailId = thumbnailResult.public_id;
        } else {
            // Use generated thumbnail
            thumbnailUrl = videoResult.eager?.[0]?.secure_url || '';
        }

        const user = await userSchema.findById(userId);
        if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
            return res.status(403).json({ error: 'Unauthorized to create content' });
        }

        const isApproved = user.role === 'admin';

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
            isApproved
        });

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
                                        <p>Please use the following button to approve the content:</p>
                                        <a class="approve-button" href="http://localhost:3000/admin/approve-content/${content._id}" target="_blank">Approve Content</a>
                                        <p>Thank you for your attention.</p>
                                    </div>
                                    <div class="footer">
                                        <p>Best regards,</p>
                                        <p>The PlaymoodTV Team</p>
                                    </div>
                                </div>
                            </body>
                        </html>
                    `
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

        res.status(201).json(content);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});









// const createContent = asyncHandler(async (req, res) => {
//     try {
//         const { title, category, description, credit, userId } = req.body;

//         if (!title || !category || !description || !credit || !userId) {
//             return res.status(400).json({ error: 'Important fields missing!' });
//         }

//         if (!req.files || req.files.length !== 1) {
//             return res.status(400).json({ error: 'Only one video file is required!' });
//         }

//         const videoFile = req.files[0];

//         if (!videoFile.mimetype.toLowerCase().startsWith('video/')) {
//             return res.status(400).json({ error: `Invalid file type: ${videoFile.mimetype}` });
//         }

//         // Upload video and extract thumbnail using Cloudinary eager transformation
//         const videoResult = await cloudinary.uploader.upload(videoFile.path, {
//             resource_type: 'video',
//             folder: 'videos',
//             eager: [{
//                 width: 320,
//                 height: 180,
//                 crop: 'pad',
//                 format: 'jpg',
//                 start_offset: '1' // 1-second mark
//             }]
//         });

//         // Delete local file
//         fs.unlinkSync(videoFile.path);

//         const thumbnailUrl = videoResult.eager?.[0]?.secure_url || '';

//         const user = await userSchema.findById(userId);
//         if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
//             return res.status(403).json({ error: 'Unauthorized to create content' });
//         }

//         const isApproved = user.role === 'admin';

//         const content = await contentSchema.create({
//             user: userId,
//             title,
//             category,
//             description,
//             credit,
//             thumbnail: thumbnailUrl,
//             video: videoResult.secure_url,
//             cloudinary_video_id: videoResult.public_id,
//             isApproved
//         });

//         if (!isApproved) {
//             const admins = await userSchema.find({ role: 'admin' });

//             admins.forEach(admin => {
//                 const mailOptions = {
//                     from: `"PlaymoodTV 📺" <${process.env.EMAIL_USERNAME}>`,
//                     to: admin.email,
//                     subject: 'New Content Approval Request',
//                     html: `
//                         <html>
//                             <head>
//                                 <style>
//                                     body { font-family: Arial, sans-serif; background-color: #f0f0f0; color: #333; padding: 20px; }
//                                     .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); }
//                                     .header { background-color: tomato; color: white; padding: 10px; text-align: center; border-top-left-radius: 8px; border-top-right-radius: 8px; }
//                                     .content { padding: 20px; }
//                                     .approve-button { display: inline-block; padding: 10px 20px; background-color: tomato; color: white; text-decoration: none; border-radius: 5px; }
//                                     .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
//                                 </style>
//                             </head>
//                             <body>
//                                 <div class="container">
//                                     <div class="header">
//                                         <h2>New Content Approval Request</h2>
//                                     </div>
//                                     <div class="content">
//                                         <p>Dear ${admin.name},</p>
//                                         <p>A new content titled "${title}" has been created and requires your approval.</p>
//                                         <p>Please use the following button to approve the content:</p>
//                                         <a class="approve-button" href="http://localhost:3000/admin/approve-content/${content._id}" target="_blank">Approve Content</a>
//                                         <p>Thank you for your attention.</p>
//                                     </div>
//                                     <div class="footer">
//                                         <p>Best regards,</p>
//                                         <p>The PlaymoodTV Team</p>
//                                     </div>
//                                 </div>
//                             </body>
//                         </html>
//                     `
//                 };

//                 transporter.sendMail(mailOptions, (error, info) => {
//                     if (error) {
//                         console.error('Error sending email:', error);
//                     } else {
//                         console.log('Email sent:', info.response);
//                     }
//                 });
//             });
//         }

//         res.status(201).json(content);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Server error' });
//     }
// });









// const createContent = asyncHandler(async (req, res) => {
//     try {
//         const { title, category, description, credit, userId } = req.body;

//         if (!title || !category || !description || !credit || !userId) {
//             return res.status(400).json({ error: 'Important fields missing!' });
//         }

//         if (!req.files || req.files.length !== 2) {
//             return res.status(400).json({ error: 'Both video and thumbnail files are required!' });
//         }

//         const [videoFile, thumbnailFile] = req.files;

//         const videoResult = await cloudinary.uploader.upload(videoFile.path, {
//             resource_type: 'video',
//             folder: "videos"
//         });

//         const thumbnailResult = await cloudinary.uploader.upload(thumbnailFile.path, {
//             folder: "thumbnails"
//         });

//         const user = await userSchema.findById(userId);
//         if (user.role !== 'creator' && user.role !== 'admin') {
//             return res.status(403).json({ error: 'Unauthorized to create content' });
//         }

//         const isApproved = user.role === 'admin';

//         const content = await contentSchema.create({
//             user: userId,
//             title,
//             category,
//             description,
//             credit,
//             thumbnail: thumbnailResult.secure_url,
//             video: videoResult.secure_url,
//             cloudinary_video_id: videoResult.public_id,
//             cloudinary_thumbnail_id: thumbnailResult.public_id,
//             isApproved
//         });

//         if (!isApproved) {
//             const admins = await userSchema.find({ role: 'admin' });
//             admins.forEach(admin => {
//                 const mailOptions = {
//                     from: `"PlaymoodTV 📺" <${process.env.EMAIL_USERNAME}>`,
//                     to: admin.email,
//                     subject: 'New Content Approval Request',
//                     html: `
//                         <html>
//                             <head>
//                                 <style>
//                                     body { font-family: Arial, sans-serif; background-color: #f0f0f0; color: #333; padding: 20px; }
//                                     .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); }
//                                     .header { background-color: tomato; color: white; padding: 10px; text-align: center; border-top-left-radius: 8px; border-top-right-radius: 8px; }
//                                     .content { padding: 20px; }
//                                     .approve-button { display: inline-block; padding: 10px 20px; background-color: tomato; color: white; text-decoration: none; border-radius: 5px; }
//                                     .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
//                                 </style>
//                             </head>
//                             <body>
//                                 <div class="container">
//                                     <div class="header">
//                                         <h2>New Content Approval Request</h2>
//                                     </div>
//                                     <div class="content">
//                                         <p>Dear ${admin.name},</p>
//                                         <p>A new content titled "${title}" has been created and requires your approval.</p>
//                                         <p>Please use the following button to approve the content:</p>
//                                         <a class="approve-button" href="http://localhost:3000/admin/approve-content/${content._id}" target="_blank">Approve Content</a>
//                                         <p>Thank you for your attention.</p>
//                                     </div>
//                                     <div class="footer">
//                                         <p>Best regards,</p>
//                                         <p>The PlaymoodTV Team</p>
//                                     </div>
//                                 </div>
//                             </body>
//                         </html>
//                     `
//                 };

//                 transporter.sendMail(mailOptions, (error, info) => {
//                     if (error) {
//                         console.error("Error sending email:", error);
//                     } else {
//                         console.log('Email sent:', info.response);
//                     }
//                 });
//             });
//         }

//         res.status(201).json(content);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Server error' });
//     }
// });

// @desc Approve Content
// @route PUT /api/content/approve/:id
// @access Private (Admin only)
const approveContent = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const content = await contentSchema.findById(id);
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        content.isApproved = true;
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

// @desc Save Video Progress
// @route POST /api/content/progress/
// @access Private
const saveVideoProgress = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { contentId, progress } = req.body;

    if (!contentId || progress === undefined || progress < 0) {
        return res.status(400).json({ error: 'Content ID and valid progress are required' });
    }

    const content = await contentSchema.findById(contentId);
    if (!content) {
        return res.status(404).json({ error: 'Content not found' });
    }

    const user = await userSchema.findById(userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const progressRecord = user.videoProgress.find(
        record => record.contentId.toString() === contentId.toString()
    );

    if (progressRecord) {
        progressRecord.progress = progress;
    } else {
        user.videoProgress.push({ contentId, progress });
    }

    await user.save();
    res.status(200).json({ 
        message: 'Video progress saved successfully', 
        contentId, 
        progress 
    });
});

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

// @desc Get all videos in user's continue watching list
// @route GET /api/content/continue-watching
// @access Private
const ContinueWatching = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Fetch user with populated videoProgress
    const user = await userSchema.findById(userId).populate({
        path: 'videoProgress.contentId',
        select: 'title category description thumbnail video views likes createdAt',
    });

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Filter videos with progress > 0 and valid content
    const continueWatching = user.videoProgress
        .filter(record => record.progress > 0 && record.contentId) // Exclude zero progress or deleted content
        .map(record => ({
            contentId: record.contentId._id,
            title: record.contentId.title,
            category: record.contentId.category,
            description: record.contentId.description,
            thumbnail: record.contentId.thumbnail,
            video: record.contentId.video,
            views: record.contentId.views,
            likes: record.contentId.likes,
            createdAt: record.contentId.createdAt,
            progress: record.progress,
        }))
        .sort((a, b) => b.createdAt - a.createdAt); // Sort by content creation date (newest first)

    // Generate ETag based on userId and videoProgress
    const etag = `"continue-watching-${userId}-${JSON.stringify(continueWatching.map(v => `${v.contentId}-${v.progress}`))}"`;

    if (req.get('If-None-Match') === etag) {
        return res.status(304).end();
    }

    res.set({
        'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
        'ETag': etag,
    });

    res.status(200).json({
        message: 'Continue watching list retrieved successfully',
        continueWatching,
    });
});





module.exports = {
    getContent,
    getRecentContent,
    getContentById,
    createContent,
    updateContent,
    deleteContent,
    approveContent,
    getUnapprovedContent,
    saveVideoProgress,
    getVideoProgress,
    ContinueWatching,
};

