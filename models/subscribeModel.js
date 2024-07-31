const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    subscriber: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'profiles',
        required: true
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'profiles',
        required: true
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
