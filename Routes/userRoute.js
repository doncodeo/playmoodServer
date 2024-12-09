const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');

const {
    getUser,
    registerUser,
    verifyEmail,
    resendVerificationCode,
    loginUser,
    deleteUser,
    updateUser,
    updateProfileImage,
    getUserprofile, 
    getCreators,
    createUser,
    likeContent,
    unlikeContent,
    getLikedContents,
    addWatchlist,
    getWatchlist,
    removeWatchlist,
    saveContentToHistory,
    getUserHistory,
    markPrivacyPolicyAsRead,
} = require('../controllers/userController');
const { protect } = require('../middleware/authmiddleware');

router.route('/').get(getUser).post(upload.single("image"), registerUser);
router.post('/verify-email', verifyEmail);
router.post('/reverify', resendVerificationCode);
router.route('/create').post(createUser);
router.route('/login').post(loginUser);
router.get('/profile', protect, getUserprofile);
router.route('/creators').get(getCreators);
router.route('/:id').put(upload.single("image"), updateUser).delete(deleteUser);
router.route('/profile-image/:id').put(protect, upload.single("image"), updateProfileImage)
router.route('/like/:id').put(likeContent); 
router.route('/unlike/:id').put(unlikeContent); 
router.route('/getlike/:id').get(getLikedContents); 
router.route('/watchlist/:id').put(addWatchlist);
router.route('/watchlist/:id').get(getWatchlist);
router.route('/unwatch/:id').put(removeWatchlist);
router.route('/history/:id').get(getUserHistory).put(saveContentToHistory);
router.route('/policy').post(protect, markPrivacyPolicyAsRead);

router.route('/test-upload').post(upload.array('files', 2), (req, res) => {
    console.log(req.files);
    res.status(200).send('Received files!');
}); 

module.exports = router;
