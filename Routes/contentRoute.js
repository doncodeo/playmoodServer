const express = require('express');
const router = express.Router();
const { getContent, postLikes, unlike, createContent, updateContent, deleteContent } = require('../controllers/contentController');
const upload = require('../middleware/multer');

router.route('/').get(getContent).post(upload.fields([{ name: 'video', maxCount: 1 }, { name: 'image', maxCount: 1 }]), createContent);
router.route('/:id').put(upload.single('video'), updateContent).delete(deleteContent);

router.route('/like').put(postLikes);
router.route('/unlike').put(unlike);

module.exports = router;

