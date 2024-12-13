const express = require('express');
const router = express.Router();
const { 
    subscribe, 
    unsubscribe, 
    getSubscribedContent, 
    getSubscribers 
} = require('../controllers/subscribeController');
const { protect } = require('../middleware/authmiddleware');

// Subscribe and unsubscribe using the root route
router.route('/')
    .post(protect, subscribe)     // Subscribe to a creator
    .put(protect, unsubscribe);  // Unsubscribe from a creator

// Fetch content from subscribed creators
router.route('/content')
    .get(protect, getSubscribedContent);

// Fetch all subscribers for a creator
router.route('/subscribers')
    .get(protect, getSubscribers);

module.exports = router;


