const express = require('express');
const router = express.Router()
const {getContent, postContent,
    
  } = require('../controllers/contentController')

  router.route('/').get(getContent).post(postContent)
  // router.route('/:id').put(updateTop10).delete(deleteTop10)


module.exports = router  