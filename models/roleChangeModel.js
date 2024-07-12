const mongoose = require('mongoose');

const roleChangeRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'profiles',
        required: true
    },
    requestedRole: {
        type: String,
        enum: ['creator'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const roleChange = mongoose.model('RoleChangeRequest', roleChangeRequestSchema);

module.exports = roleChange;
