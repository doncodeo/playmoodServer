const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const userData = require('../models/userModel');
const UserSessionEvent = require('../models/userSessionEventModel');


const parseUserAgent = (ua = '') => {
    const lowered = ua.toLowerCase();
    let os = 'unknown';
    if (lowered.includes('android')) os = 'android';
    else if (lowered.includes('iphone') || lowered.includes('ipad') || lowered.includes('ios')) os = 'ios';
    else if (lowered.includes('windows')) os = 'windows';
    else if (lowered.includes('mac os')) os = 'macos';
    let device = 'web';
    if (lowered.includes('mobile')) device = 'mobile';
    if (lowered.includes('tablet') || lowered.includes('ipad')) device = 'tablet';
    return { os, device };
};

const trackSessionEvent = async (req, userId) => {
    try {
        const ua = req.headers['user-agent'] || '';
        const { os, device } = parseUserAgent(ua);
        await UserSessionEvent.create({
            userId,
            ip: req.ip || req.headers['x-forwarded-for'] || '',
            userAgent: ua,
            device,
            os,
            country: req.headers['x-country'] || 'unknown',
            city: req.headers['x-city'] || 'unknown',
            route: req.originalUrl || req.url,
            method: req.method,
        });
    } catch (e) { }
};

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await userData.findById(decoded.id).select('-password');
            trackSessionEvent(req, decoded.id);

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ error: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ error: 'Not authorized, no token' });
        return;
    }
});

const optionalProtect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await userData.findById(decoded.id).select('-password');
            trackSessionEvent(req, decoded.id);
        } catch (error) {
            console.error('Optional Auth Error:', error.message);
        }
    }
    next();
});

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(401);
        throw new Error('Not authorized as an admin');
    }
};

const creator = (req, res, next) => {
    if (req.user && (req.user.role === 'creator' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(401);
        throw new Error('Not authorized as a creator');
    }
};

module.exports = { 
    protect, 
    optionalProtect,
    admin,
    creator
};