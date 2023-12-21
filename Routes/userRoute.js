const express = require('express');
const router = express.Router()
const {getUser,
    postUser, 
    deleteUser,
    updateUser,
  } = require('../controllers/userController');

  router.route('/').get(getUser).post(postUser)
  router.route('/:id').put(updateUser).delete(deleteUser)


module.exports = router  