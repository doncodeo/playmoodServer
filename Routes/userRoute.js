const express = require('express');
const router = express.Router()
const {getUser,
    registerUser, 
    loginUser,
    deleteUser,
    updateUser,
    getUserprofile,
  } = require('../controllers/userController');
  const {protect} = require('../middleware/authmiddleware');

  router.route('/').get(getUser).post(registerUser);
  router.route('/login').post(loginUser);
  router.get('/profile', protect, getUserprofile);
  router.route('/:id').put(updateUser).delete(deleteUser); 


module.exports = router  