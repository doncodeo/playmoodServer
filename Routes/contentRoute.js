const express = require('express');
const router = express.Router()
const {getContent, postContent,postLikes, unlike
    
  } = require('../controllers/contentController')

  router.route('/').get(getContent).post(postContent);
  router.route('/like').put(postLikes);
  router.route('/unlike').put(unlike)
  // router.route('/:id').put(updateTop10).delete(deleteTop10) 


module.exports = router  