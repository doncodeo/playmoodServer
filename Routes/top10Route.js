const express = require('express');
const router = express.Router()
const {getTop10, postTop10,
    
  } = require('../controllers/top10Controller')

  router.route('/').get(getTop10).post(postTop10)
  // router.route('/:id').put(updateTop10).delete(deleteTop10)


module.exports = router  