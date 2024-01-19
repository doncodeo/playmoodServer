const express = require('express');
const router = express.Router()
const upload = require('../middleware/multer');
const {getUser,
    registerUser, 
    loginUser,
    deleteUser,
    updateUser,
    getUserprofile,
    createUser,
    likeContent,
    unlikeContent,
    getLikedContents,
    addWatchlist,
    getWatchlist,
    removeWatchlist,
    saveContentToHistory,
    getUserHistory,
  } = require('../controllers/userController');
  const {protect} = require('../middleware/authmiddleware');
  

  router.route('/').get(getUser).post( upload.single("image"), registerUser);
  router.route('/create').post(createUser)
  router.route('/login').post(loginUser);
  router.get('/profile', protect, getUserprofile);
  router.route('/:id').put(upload.single("image"), updateUser).delete(deleteUser); 
  router.route('/like/:id').put(likeContent);
  router.route('/unlike/:id').put(unlikeContent);
  router.route('/getlike/:id').get(getLikedContents);
  router.route('/watchlist/:id').put(addWatchlist);
  router.route('/getwatchlist/:id').get(getWatchlist);
  router.route('/removelist/:id').put(removeWatchlist);
  router.route('/history/:id').get(getUserHistory).put(saveContentToHistory);



  router.route('/test-upload').post(upload.array('files', 2), (req, res) => {
    console.log(req.files);
    res.status(200).send('Received files!');
});



module.exports = router  