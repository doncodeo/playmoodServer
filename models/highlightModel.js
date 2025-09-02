const mongoose = require('mongoose');

const highlightSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'profiles',
            required: true,
        },
        content: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contents',
            required: true,
        },
        startTime: {
            type: Number,
            required: true,
        },
        endTime: {
            type: Number,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Highlights', highlightSchema);
