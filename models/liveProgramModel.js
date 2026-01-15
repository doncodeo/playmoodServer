const mongoose = require('mongoose');

const liveProgramSchema = new mongoose.Schema(
    {
        contentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contents',
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        thumbnail: {
            type: String,
            required: true,
        },
        date: {
            type: String,
            required: true,
        },
        startTime: {
            type: String,
            required: true,
        },
        endTime: {
            type: String,
            required: true,
        },
        duration: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['scheduled', 'live', 'ended'],
            default: 'scheduled',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('LiveProgram', liveProgramSchema);
