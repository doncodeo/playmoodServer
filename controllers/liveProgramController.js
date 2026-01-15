const asyncHandler = require('express-async-handler');
const LiveProgram = require('../models/liveProgramModel');
const Content = require('../models/contentModel');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');

// @desc    Get today's live programming
// @route   GET /api/live-programs/today
// @access  Public
const getTodaysProgramming = asyncHandler(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10); // Get YYYY-MM-DD

    const programs = await LiveProgram.find({ date: today }).sort({ startTime: 'asc' }).populate('videoId', 'title description thumbnail video');

    const now = new Date();
    let liveProgram = null;
    const upcomingPrograms = [];

    for (const program of programs) {
        const programStartTime = new Date(`${program.date}T${program.startTime}:00`);
        const programEndTime = new Date(programStartTime.getTime() + program.duration * 1000);

        if (now >= programStartTime && now < programEndTime) {
            // This is the currently live program
            const currentPlaybackTime = (now.getTime() - programStartTime.getTime()) / 1000;
            liveProgram = {
                ...program.toObject(),
                status: 'live',
                currentPlaybackTime, // The "live edge"
            };
        } else if (now < programStartTime) {
            // This program is upcoming
            upcomingPrograms.push(program.toObject());
        }
    }

    res.status(200).json({
        liveProgram,
        upcomingPrograms,
    });
});


// @desc    Create a new live program
// @route   POST /api/live-programs
// @access  Private/Admin
const createLiveProgram = asyncHandler(async (req, res) => {
    const { videoId, date, startTime } = req.body;

    if (!videoId || !date || !startTime) {
        return res.status(400).json({ error: 'Missing required fields: videoId, date, startTime' });
    }

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        return res.status(400).json({ error: 'Invalid videoId format' });
    }

    const video = await Content.findById(videoId);
    if (!video) {
        return res.status(404).json({ error: 'Video content not found' });
    }

    // Fetch video details from Cloudinary to get the actual duration
    let durationInSeconds;
    try {
        const videoDetails = await cloudinary.api.resource(video.cloudinary_video_id, { resource_type: 'video' });
        if (!videoDetails || !videoDetails.duration) {
            // Fallback to a default if duration is not available, and log an error
            console.error(`Could not retrieve duration for video ${video.cloudinary_video_id}. Falling back to 1 hour.`);
            durationInSeconds = 3600;
        } else {
            durationInSeconds = Math.round(videoDetails.duration);
        }
    } catch (error) {
        console.error('Failed to fetch video details from Cloudinary:', error);
        return res.status(500).json({ error: 'Failed to retrieve video metadata for scheduling.' });
    }

    const programStartTime = new Date(`${date}T${startTime}:00`);
    const programEndTime = new Date(programStartTime.getTime() + durationInSeconds * 1000);

    const newProgram = await LiveProgram.create({
        videoId,
        title: video.title,
        description: video.description,
        thumbnail: video.thumbnail,
        date,
        startTime,
        endTime: programEndTime.toTimeString().slice(0, 5),
        duration: durationInSeconds,
        status: 'scheduled',
    });

    res.status(201).json(newProgram);
});

// @desc    Update a live program
// @route   PUT /api/live-programs/:id
// @access  Private/Admin
const updateLiveProgram = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { date, startTime, videoId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid program ID format' });
    }

    const program = await LiveProgram.findById(id);
    if (!program) {
        return res.status(404).json({ error: 'Live program not found' });
    }

    let video = await Content.findById(program.videoId);
    if (videoId && videoId !== program.videoId.toString()) {
        if (!mongoose.Types.ObjectId.isValid(videoId)) {
            return res.status(400).json({ error: 'Invalid videoId format' });
        }
        const newVideo = await Content.findById(videoId);
        if (!newVideo) {
            return res.status(404).json({ error: 'New video content not found' });
        }
        video = newVideo;
        program.videoId = videoId;
        program.title = video.title;
        program.description = video.description;
        program.thumbnail = video.thumbnail;
    }

    program.date = date || program.date;
    program.startTime = startTime || program.startTime;

    // Recalculate end time if start time or date changes
    const durationInSeconds = program.duration;
    const programStartTime = new Date(`${program.date}T${program.startTime}:00`);
    const programEndTime = new Date(programStartTime.getTime() + durationInSeconds * 1000);
    program.endTime = programEndTime.toTimeString().slice(0, 5);

    const updatedProgram = await program.save();
    res.status(200).json(updatedProgram);
});

// @desc    Delete a live program
// @route   DELETE /api/live-programs/:id
// @access  Private/Admin
const deleteLiveProgram = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid program ID format' });
    }

    const program = await LiveProgram.findById(id);
    if (!program) {
        return res.status(404).json({ error: 'Live program not found' });
    }

    await LiveProgram.findByIdAndDelete(id);

    res.status(200).json({ message: 'Live program deleted successfully' });
});


module.exports = {
    getTodaysProgramming,
    createLiveProgram,
    updateLiveProgram,
    deleteLiveProgram,
};