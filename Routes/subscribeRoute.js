const express = require('express');
const router = express.Router();
const {
    subscribe,
    unsubscribe,
} = require('../controllers/subscribeController');
const { protect } = require('../middleware/authmiddleware');


router.route('/')
    .post(protect, subscribe)
    .put(protect, unsubscribe)

module.exports = router;
