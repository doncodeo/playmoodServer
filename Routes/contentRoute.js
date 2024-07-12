const express = require('express');
const router = express.Router();
const { 
    getContent, 
    createContent, 
    updateContent, 
    deleteContent, 
    getContentById, 
    approveContent,
    getUnapprovedContent
} = require('../controllers/contentController');
const upload = require('../middleware/multer');

router.route('/')
    .get(getContent)
    .post(upload.array('files', 2), createContent);

router. route('/unapproved')
    .get(getUnapprovedContent);

router.route('/:id')
    .get(getContentById)  // New route to get content by ID
    .put(upload.single('video'), updateContent)
    .delete(deleteContent);

router.route('/approve/:id') 
    .put(approveContent)  // New route to get content by ID


module.exports = router;


