const express = require('express');
const router = express.Router()
const {getUser,
    registerUser, 
    loginUser,
    getMe,
    deleteUser,
    updateUser,
  } = require('../controllers/userController');
  const {protect} = require('../middleware/authmiddleware');

  router.route('/').get(getUser).post(registerUser);
  router.route('/login').post(loginUser);
  router.get('/me', getMe);
  router.route('/:id').put(updateUser).delete(deleteUser); 


module.exports = router  