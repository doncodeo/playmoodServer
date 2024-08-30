const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');


const {  
    getChannelDetails,   
    updateChannelInfo,
    updateChannelBannerImage
} = require('../controllers/channelController');
const { protect } = require('../middleware/authmiddleware');

router.route('/:id')
    .get(protect, getChannelDetails)
    .put(protect, updateChannelInfo);

router.route('/:id/banner')
    .put(protect, upload.single('image'), updateChannelBannerImage);

module.exports = router;
 