const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const ForcedRecommendation = require('../models/forcedRecommendationModel');

const listForcedRecommendations = asyncHandler(async (_req, res) => {
    const items = await ForcedRecommendation.find().sort({ createdAt: -1 }).populate('contentId', 'title thumbnail').populate('createdBy', 'name');
    res.status(200).json(items);
});

const createForcedRecommendation = asyncHandler(async (req, res) => {
    const { contentId, reason = '', priority = 100, startsAt, endsAt, isActive = true } = req.body;
    if (!mongoose.Types.ObjectId.isValid(contentId)) return res.status(400).json({ error: 'Invalid contentId' });
    const created = await ForcedRecommendation.create({ contentId, reason, priority, startsAt, endsAt: endsAt || null, isActive, createdBy: req.user._id });
    res.status(201).json(created);
});

const updateForcedRecommendation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
    const updated = await ForcedRecommendation.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(updated);
});

const deleteForcedRecommendation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
    const deleted = await ForcedRecommendation.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.status(200).json({ message: 'Deleted' });
});

module.exports = { listForcedRecommendations, createForcedRecommendation, updateForcedRecommendation, deleteForcedRecommendation };
