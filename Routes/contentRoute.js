const express = require('express');
const router = express.Router()
const {getContent, createContent,updateContent, deleteContent, unlikeContent,getLikedContents} = require('../controllers/contentController');
  const upload = require('../middleware/multer')
  // const { single: uploadSingle } = require('../middleware/contentMulter');
  

// router.route('/').get(getContent).post(uploadSingle('video'), createContent);
router.route('/').get(getContent).post( upload.single("video"), createContent);
router.route('/:id').put(upload.single("video"), updateContent).delete(deleteContent); 

  


module.exports = router  
