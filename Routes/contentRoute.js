const express = require('express');
const router = express.Router()
const {getContent,postLikes, unlike, createContent,updateContent, deleteContent} = require('../controllers/contentController');
  const upload = require('../middleware/multer')
  // const { single: uploadSingle } = require('../middleware/contentMulter');
  

// router.route('/').get(getContent).post(uploadSingle('video'), createContent);
router.route('/').get(getContent).post( upload.single("video"), createContent);
router.route('/:id').put(upload.single("video"), updateContent).delete(deleteContent); 

router.route('/like').put(postLikes);
router.route('/unlike').put(unlike)
  // router.route('/:id').put(updateTop10).delete(deleteTop10) 



module.exports = router  