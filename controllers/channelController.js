const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises;

// @desc Get a creator's channel details
// @route GET /api/channel/:id
// @access Private (authenticated)
const getChannelDetails = asyncHandler(async (req, res) => {
  const { id } = req.params; // Use id to match route parameter

  // Validate userId format (assuming MongoDB ObjectId)
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Fetch the user and ensure they are a creator
  const creator = await User.findOne({ _id: id, role: 'creator' })
    .populate('subscriptions', 'name profileImage')
    // .populate('communityPosts', 'title content'); // Uncomment when communityPosts is implemented

  if (!creator) {
    return res.status(404).json({ error: 'Creator not found' });
  }

  // Fetch content posted by the creator
  const content = await Content.find({ user: creator._id });

  // Respond with the channel details
  res.status(200).json({
    name: creator.name,
    profileImage: creator.profileImage,
    about: creator.about,
    bannerImage: creator.bannerImage,
    subscribers: creator.subscriptions.length,
    content, // All content uploaded by the creator
    communityPosts: creator.communityPosts || [], // Fallback to empty array if not implemented
  });
});

// @desc Update creator channel information
// @route PUT /api/channel/:id
// @access Private (authenticated, creator only)
const updateChannelInfo = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const updates = req.body;

  // Validate userId format
  if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Find the user by ID and ensure they are a creator
  const user = await User.findById(userId);

  if (!user || user.role !== 'creator') {
    return res.status(404).json({ error: 'Creator not found' });
  }

  // Check if the authenticated user is the creator
  if (user._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'You are not authorized to update this channel' });
  }

  // Update only allowed fields
  const allowedFields = ['about']; // Add other fields as needed
  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      user[key] = updates[key];
    }
  });

  // Save the updated creator information
  await user.save();

  res.status(200).json({ message: 'Channel information updated successfully', about: user.about });
});

// @desc Update creator channel banner image
// @route PUT /api/channel/:id/banner
// @access Private (authenticated, creator only)
const updateChannelBannerImage = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const file = req.file;

  // Validate userId format
  if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Find the user by ID and ensure they are a creator
  const user = await User.findById(userId);

  if (!user || user.role !== 'creator') {
    return res.status(404).json({ error: 'Creator not found' });
  }

  // Check if the authenticated user is the creator
  if (user._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'You are not authorized to update this channel' });
  }

  let bannerImageUrl = user.bannerImage; // Keep existing banner image URL

  if (file) {
    // Upload new banner image to Cloudinary
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'channel-banners',
      public_id: `${userId}-${Date.now()}`,
    });

    // Delete the old banner image from Cloudinary if it exists
    if (user.bannerImageId) {
      await cloudinary.uploader.destroy(user.bannerImageId);
    }

    // Update the banner image URL and Cloudinary ID
    bannerImageUrl = result.secure_url;
    user.bannerImageId = result.public_id;

    // Delete the local file after upload
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.warn(`Failed to delete local file ${file.path}:`, error.message);
    }
  } else {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Update the user profile with the new banner image URL
  user.bannerImage = bannerImageUrl || process.env.DEFAULT_BANNER_IMAGE_URL || 'https://example.com/default-banner.jpg';
  await user.save();

  res.status(200).json({ message: 'Channel banner image updated successfully', bannerImage: user.bannerImage });
});

module.exports = {
  getChannelDetails,
  updateChannelInfo,
  updateChannelBannerImage,
};





// const asyncHandler = require('express-async-handler');
// const User = require('../models/userModel');
// const Content = require('../models/contentModel');
// const cloudinary = require('../config/cloudinary');


// // @desc Get a creator's channel details
// // @route GET /api/channels/:creatorId
// // @access Public

// const getChannelDetails = asyncHandler(async (req, res) => {
//     const { userId } = req.params; // Use userId to fetch the user

//     // Fetch the user and ensure they are a creator
//     const creator = await User.findOne({ userId, role: 'creator' })
//         .populate('subscriptions', 'name profileImage')
//         // .populate('communityPosts', 'title content');

//     if (!creator) {
//         return res.status(404).json({ error: 'Creator not found' });
//     }
 
//     // Fetch content posted by the creator
//     const content = await Content.find({ user: creator._id });

//     // Respond with the channel details
//     res.status(200).json({
//         name: creator.name,
//         profileImage: creator.profileImage,
//         about: creator.about,
//         bannerImage: creator.bannerImage,
//         subscribers: creator.subscriptions.length,
//         content, // All content uploaded by the creator
//         communityPosts: creator.communityPosts // If community posts are part of the channel
//     });
// });

// const updateChannelInfo = asyncHandler(async (req, res) => {
//     try {
//         const userId = req.params.id; 
//         const updates = req.body; // The fields to update are provided in the request body

//         // Find the user by ID and ensure they are a creator
//         const user = await User.findById(userId);

//         if (!user || user.role !== 'creator') {
//             return res.status(404).json({ error: 'Creator not found' });
//         }

//         if (user._id.toString() !== req.user._id.toString()) {
//             return res.status(403).json({ error: 'You are not authorized to update this channel' });
//         }

//         // Mapping over the updates to selectively update only the fields provided
//         Object.keys(updates).forEach((key) => {
//             if (key in user) {
//                 user[key] = updates[key];
//             }
//         });

//         // Save the updated creator information
//         await user.save();

//         res.status(200).json({ message: 'Channel information updated successfully', about: user.about });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Server error' });
//     }
// });

// const updateChannelBannerImage = asyncHandler(async (req, res) => {
//     try {
//         const userId = req.params.id; // Assuming the creator's ID is passed as a parameter
//         const file = req.file;

//         // Find the user by ID and ensure they are a creator
//         const user = await User.findById(userId);

//         if (!user || user.role !== 'creator') {
//             return res.status(404).json({ error: 'Creator not found' });
//         }

//         if (user._id.toString() !== req.user._id.toString()) {
//             return res.status(403).json({ error: 'You are not authorized to update this channel' });
//         }

//         let bannerImageUrl = user.bannerImage; // Keep the existing banner image URL

//         if (file) {
//             // Upload new banner image to Cloudinary
//             const result = await cloudinary.uploader.upload(file.path, {
//                 folder: 'channel-banners', // Optional folder
//                 public_id: `${userId}-${Date.now()}` // Unique ID for the image
//             });

//             // Delete the old banner image from Cloudinary if it exists
//             if (user.bannerImageId) {
//                 await cloudinary.uploader.destroy(user.bannerImageId);
//             }

//             // Update the banner image URL and Cloudinary ID
//             bannerImageUrl = result.secure_url;
//             user.bannerImageId = result.public_id;

//             // Optionally, delete the local file after upload
//             const fs = require('fs');
//             fs.unlinkSync(file.path);
//         }

//         // Update the user profile with the new banner image URL
//         user.bannerImage = bannerImageUrl || 'default-banner-image-url'; // Use default if none exists
//         await user.save();

//         res.status(200).json({ message: 'Channel banner image updated successfully', bannerImage: user.bannerImage });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Server error' });
//     }
// });

// module.exports = { 
//     getChannelDetails,
//     updateChannelInfo, 
//     updateChannelBannerImage
// };
