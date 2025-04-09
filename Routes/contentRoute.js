const express = require('express');
const router = express.Router();
const { 
    getContent, 
    getRecentContent,
    createContent, 
    updateContent, 
    deleteContent, 
    getContentById, 
    approveContent,
    getUnapprovedContent,
    saveVideoProgress,
    getVideoProgress,
} = require('../controllers/contentController');
const upload = require('../middleware/multer');
const { protect } = require('../middleware/authmiddleware');

router.route('/')
    .get(getContent)
    .post(upload.array('files', 2), createContent);

    router.route('/new')
    .get(getRecentContent)

router. route('/unapproved') 
    .get(getUnapprovedContent);

router.route('/:id')
    .get(getContentById)  // New route to get content by ID
    .put(upload.single('video'), updateContent)
    .delete(deleteContent);

router.route('/approve/:id') 
    .put(approveContent)  // New route to get content by ID

router.route('/progress/:id')
    .get(protect, getVideoProgress)

router.route('/progress/')
    .post(protect, saveVideoProgress);


module.exports = router;


