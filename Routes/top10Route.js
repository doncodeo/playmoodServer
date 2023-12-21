const express = require('express');
const router = express.Router()
const {getUser, postUser,
    
  } = require('../controllers/userController')

  router.route('/').get(getUser).post(postUser)
  // router.route('/:id').put(updateTop10).delete(deleteTop10)


module.exports = router  