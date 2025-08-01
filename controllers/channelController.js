const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises;
const mongoose = require('mongoose');



// @desc Get creator channel details
// @route GET /api/creators/:userId
// @access Public
const getChannelDetails = asyncHandler(async (req, res) => {
    const { userId } = req.params; 

    // Validate userId presence 
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    } 

    // Validate userId format (MongoDB ObjectId)
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Fetch creator with populated subscribers and communityPosts
    const creator = await User.findOne({ _id: userId, role: 'creator' })
        .populate('subscribers', 'name profileImage') // Populate subscribers to get their details
        .populate('communityPosts', 'title content'); // Uncommented to populate community posts

    if (!creator) {
        return res.status(404).json({ error: 'Creator not found' });
    }

    // Fetch creator's content
    const content = await Content.find({ user: creator._id, isApproved: true }).select(
        'title category description thumbnail video views likes createdAt'
    );

    res.status(200).json({
        name: creator.name,
        profileImage: creator.profileImage,
        about: creator.about,
        bannerImage: creator.bannerImage,
        subscribers: creator.subscribers.length, // Correct field: subscribers, not subscriptions
        subscriberDetails: creator.subscribers, // Optional: Include subscriber details
        content,
        communityPosts: creator.communityPosts || [],
        instagram: creator.instagram || "",
        tiktok: creator.tiktok || "",
        linkedin: creator.linkedin || "",
        twitter: creator.twitter || ""
    });
});

// @desc Update creator channel information
// @route PUT /api/channel/:userId
// @access Private (authenticated, creator only)
const updateChannelInfo = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const updates = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const user = await User.findById(userId);

  if (!user || user.role !== 'creator') {
    return res.status(404).json({ error: 'Creator not found' });
  }

  if (user._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'You are not authorized to update this channel' });
  }

  const allowedFields = ['about', 'name', 'profileImage', 'instagram', 'tiktok', 'linkedin', 'twitter'];
  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      user[key] = updates[key] || user[key]; // Preserve existing value if update is empty
    }
  });

  await user.save();

  res.status(200).json({
    message: 'Channel information updated successfully',
    name: user.name,
    about: user.about,
    profileImage: user.profileImage,
    instagram: user.instagram,
    tiktok: user.tiktok,
    linkedin: user.linkedin,
    twitter: user.twitter
  });
});

// @desc Update creator channel banner image
// @route PUT /api/channel/:userId/banner
// @access Private (authenticated, creator only)
const updateChannelBannerImage = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const user = await User.findById(userId);

  if (!user || user.role !== 'creator') {
    return res.status(404).json({ error: 'Creator not found' });
  }

  if (user._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'You are not authorized to update this channel' });
  }

  let bannerImageUrl = user.bannerImage;

  if (req.file) {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'channel-banners',
      public_id: `${userId}-${Date.now()}`,
    });

    if (user.bannerImageId) {
      await cloudinary.uploader.destroy(user.bannerImageId);
    }

    bannerImageUrl = result.secure_url;
    user.bannerImageId = result.public_id;

    try {
      await fs.unlink(req.file.path);
    } catch (error) {
      console.warn(`Failed to delete local file ${req.file.path}:`, error.message);
    }
  } else {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  user.bannerImage = bannerImageUrl || process.env.DEFAULT_BANNER_IMAGE_URL || 'https://example.com/default-banner.jpg';
  await user.save();

  res.status(200).json({ message: 'Channel banner image updated successfully', bannerImage: user.bannerImage });
});

// @desc Get all creator channels
// @route GET /api/channels
// @access Public
const getAllChannels = asyncHandler(async (req, res) => {
    // Fetch all creators with populated subscribers and communityPosts
    const creators = await User.find({ role: 'creator' })
        .populate('subscribers', 'name profileImage') // Populate subscribers to get their details
        .populate('communityPosts', 'title content'); // Populate community posts

    if (!creators || creators.length === 0) {
        return res.status(404).json({ error: 'No creators found' });
    }

    // Fetch content for each creator
    const channels = await Promise.all(
        creators.map(async (creator) => {
            const content = await Content.find({ user: creator._id }).select(
                'title category description thumbnail video views likes createdAt'
            );

            return {
                _id: creator._id,
                name: creator.name,
                profileImage: creator.profileImage,
                about: creator.about,
                bannerImage: creator.bannerImage,
                subscribers: creator.subscribers.length,
                subscriberDetails: creator.subscribers, // Optional: Include subscriber details
                content,
                communityPosts: creator.communityPosts || [],
                instagram: creator.instagram || '',
                tiktok: creator.tiktok || '',
                linkedin: creator.linkedin || '',
                twitter: creator.twitter || ''
            };
        })
    );

    res.status(200).json({
        message: 'Channels retrieved successfully',
        channels
    });
});

// @desc Get creator's own channel details
// @route GET /api/channel/my-channel
// @access Private (authenticated creator only)
const getMyChannelDetails = asyncHandler(async (req, res) => {
    const userId = req.user._id; // From protect middleware
  // const { userId } = req.params;


    console.log(userId)

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid user ID:', userId);
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if user is a creator
    if (req.user.role !== 'creator') {
        console.error('Unauthorized access - not a creator:', userId);
        return res.status(403).json({ error: 'Forbidden - Creator access required' });
    }

    try {
        // Fetch creator with populated subscribers and communityPosts
        const creator = await User.findOne({ _id: userId, role: 'creator' })
            .populate('subscribers', 'name profileImage')
            .populate('communityPosts', 'title content');

        if (!creator) {
            console.error('Creator not found:', userId);
            return res.status(404).json({ error: 'Creator not found' });
        }

        // Fetch all of creator's content (approved and unapproved)
        const content = await Content.find({ user: creator._id }).select(
            'title category description thumbnail video views likes createdAt isApproved rejectionReason'
        );

        res.status(200).json({
            name: creator.name,
            profileImage: creator.profileImage,
            about: creator.about,
            bannerImage: creator.bannerImage,
            subscribers: creator.subscribers.length,
            subscriberDetails: creator.subscribers,
            content,
            communityPosts: creator.communityPosts || [],
            instagram: creator.instagram || '',
            tiktok: creator.tiktok || '',
            linkedin: creator.linkedin || '',
            twitter: creator.twitter || '',
        });
    } catch (error) {
        console.error('Get channel details error:', {
            message: error.message || 'No message',
            name: error.name || 'No name',
            stack: error.stack || 'No stack',
        });
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid user ID', details: error.message });
        }
        res.status(500).json({ error: 'Server error', details: error.message || 'Unknown error' });
    }
});

module.exports = {
  getChannelDetails,
  updateChannelInfo,
  updateChannelBannerImage,
  getAllChannels,
  getMyChannelDetails
};