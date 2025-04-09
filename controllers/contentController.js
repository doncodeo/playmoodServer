const asyncHandler = require('express-async-handler');
const contentSchema = require('../models/contentModel');
const userSchema = require('../models/userModel');
const cloudinary = require('../config/cloudinary');
const nodemailer = require('nodemailer');


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
    // const content = await contentSchema.find().populate('user', 'name');
    res.status(200).json(content);
});

const getRecentContent = asyncHandler(async (req, res) => {
    try {
        // Fetch the last 10 most recent contents, sorted by their creation timestamp
        const recentContents = await contentSchema.find({ isApproved: true })
            .sort({ createdAt: -1 }) // Sort by timestamp in descending order
            .limit(10) // Limit the results to the last 10 contents
            .populate('user', 'name'); // Populate user details for each content

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
        res.status(200).json(content);
    } catch (error) {
        console.error(`Error fetching unapproved content: ${error.message}`);
        res.status(500).json({ error: 'Server error, please try again later' });
    }
});

// @desc Get Content by ID
// @route GET /api/content/:id
// @access Private

// const getContentById = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     // const userId = req.user ? req.user._id : null; // Check if the user is logged in
//     const viewerIP = req.ip; // Get the IP address of the viewer

//     console.log(id);

//     const content = await contentSchema.findById(id).populate('user', 'name');

//     if (!content) {
//         return res.status(404).json({ error: 'Content not found' });
//     }

//     // Increment the view count
//     // content.views += 1;

//     // Check if the viewer is a logged-in user
//     if (id && !content.viewers.includes(id)) {
//         // Increment the view count and add the user to the viewers array
//         content.views += 1;
//         content.viewers.push(id);
//     } 
//     // If not a logged-in user, check the IP address
//     else if (!userId && !content.viewerIPs.includes(viewerIP)) {
//         // Increment the view count and add the IP address to the viewerIPs array
//         content.views += 1;
//         content.viewerIPs.push(viewerIP);
//     }

//     await content.save();

//     res.status(200).json(content);
// });

// const getContentById = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const userId = req.params;
//     const viewerIP = req.ip; // Get the IP address of the viewer

//     const content = await contentSchema.findById(id).populate('user', 'name');

//     if (!content) {
//         return res.status(404).json({ error: 'Content not found' });
//     }

//     // Check if the viewer is a logged-in user or an anonymous viewer
//     const hasViewed = (userId && content.viewers.includes(userId)) || content.viewerIPs.includes(viewerIP);

//     if (!hasViewed) {
//         // Increment the view count
//         content.views += 1;

//         // Add userId to viewers array if logged in
//         if (userId) {
//             content.viewers.push(userId);
//         } 
//         // Otherwise, add the IP address to viewerIPs array
//         else {
//             content.viewerIPs.push(viewerIP);
//         }

//         await content.save();
//     }

//     res.status(200).json(content);
// });

const getContentById = asyncHandler(async (req, res) => {
    const { id } = req.params; // Content ID from URL
    const userId = req.user ? req.user._id : null; // Get the logged-in user's ID (assuming you're using req.user)
    const viewerIP = req.ip; // Get the IP address of the viewer

    const content = await contentSchema.findById(id).populate('user', 'name');

    if (!content) {
        return res.status(404).json({ error: 'Content not found' });
    }

    // Check if the viewer is a logged-in user or an anonymous viewer
    const hasViewed = (userId && content.viewers.some(viewer => viewer.toString() === userId.toString())) || 
                      content.viewerIPs.includes(viewerIP);

    if (!hasViewed) {
        // Increment the view count
        content.views += 1;

        // Add userId to viewers array if logged in
        if (userId) {
            content.viewers.push(userId); // Push the ObjectId directly
        } 
        // Otherwise, add the IP address to viewerIPs array
        else {
            content.viewerIPs.push(viewerIP);
        }

        await content.save();
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

        // Fetch the user to check their role
        const user = await userSchema.findById(userId);

        // Check if user is authorized to create content
        if (user.role !== 'creator' && user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized to create content' });
        }

        // Set isApproved based on the user's role
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

        // If the user is not an admin, send an email to the admin for approval
        if (!isApproved) {
            // Fetch admin users
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
                                    body {
                                        font-family: Arial, sans-serif;
                                        background-color: #f0f0f0;
                                        color: #333;
                                        padding: 20px;
                                    }
                                    .container {
                                        max-width: 600px;
                                        margin: 0 auto;
                                        background-color: #ffffff;
                                        padding: 20px;
                                        border-radius: 8px;
                                        box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
                                    }
                                    .header {
                                        background-color: tomato;
                                        color: white;
                                        padding: 10px;
                                        text-align: center;
                                        border-top-left-radius: 8px;
                                        border-top-right-radius: 8px;
                                    }
                                    .content {
                                        padding: 20px;
                                    }
                                    .approve-button {
                                        display: inline-block;
                                        padding: 10px 20px;
                                        background-color: tomato;
                                        color: white;
                                        text-decoration: none;
                                        border-radius: 5px;
                                    }
                                    .footer {
                                        margin-top: 20px;
                                        text-align: center;
                                        color: #666;
                                        font-size: 12px;
                                    }
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
                        console.error("Error sending email:", error);
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

const saveVideoProgress = asyncHandler(async (req, res) => {
    const userId = req.user._id; // From auth middleware
    const { contentId, progress } = req.body;

    // Validate input
    if (!contentId || progress === undefined || progress < 0) {
        return res.status(400).json({ error: 'Content ID and valid progress are required' });
    }

    // Check if content exists
    const content = await contentSchema.findById(contentId);
    if (!content) {
        return res.status(404).json({ error: 'Content not found' });
    }

    // Find the user
    const user = await userSchema.findById(userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Check if progress for this content already exists
    const progressRecord = user.videoProgress.find(
        record => record.contentId.toString() === contentId.toString()
    );

    if (progressRecord) {
        // Update existing progress
        progressRecord.progress = progress;
    } else {
        // Add new progress record
        user.videoProgress.push({ contentId, progress });
    }

    await user.save();
    res.status(200).json({ 
        message: 'Video progress saved successfully', 
        contentId, 
        progress 
    });
});

const getVideoProgress = asyncHandler(async (req, res) => {
    const userId = req.user._id; // From auth middleware
    const { contentId } = req.params;

    // Validate input
    if (!contentId) {
        return res.status(400).json({ error: 'Content ID is required' });
    }

    // Find the user and populate videoProgress
    const user = await userSchema.findById(userId).populate('videoProgress.contentId');
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Find the progress for the specific content
    const progressRecord = user.videoProgress.find(
        record => record.contentId._id.toString() === contentId.toString()
    );

    if (!progressRecord) {
        return res.status(200).json({ progress: 0 }); // Default to 0 if no progress exists
    }

    res.status(200).json({ progress: progressRecord.progress });
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
    getVideoProgress
};

