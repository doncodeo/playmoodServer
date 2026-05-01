const mongoose = require('mongoose');

const userSessionEventSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'profiles', required: true, index: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    device: { type: String, default: 'unknown', index: true },
    os: { type: String, default: 'unknown', index: true },
    country: { type: String, default: 'unknown', index: true },
    city: { type: String, default: 'unknown' },
    route: { type: String, default: '' },
    method: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('UserSessionEvent', userSessionEventSchema);
