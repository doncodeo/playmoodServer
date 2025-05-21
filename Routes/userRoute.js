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

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 65a8025e3af4e7929b379e7b
 *         name:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           example: john@example.com
 *         role:
 *           type: string
 *           example: user
 *         profileImage:
 *           type: string
 *           example: https://res.cloudinary.com/.../image.jpg
 *         cloudinary_id:
 *           type: string
 *           example: user-uploads/qdayeocck7k6zzqqery15
 *         likes:
 *           type: array
 *           items:
 *             type: string
 *           example: ["65a6fc7b72128447ad32024e"]
 *         watchlist:
 *           type: array
 *           items:
 *             type: string
 *           example: ["65a6fc7b72128447ad32024e"]
 *         history:
 *           type: array
 *           items:
 *             type: string
 *           example: ["65a6fc7b72128447ad32024e"]
 *         verified:
 *           type: boolean
 *           example: false
 *         hasReadPrivacyPolicy:
 *           type: boolean
 *           example: false
 *     Content:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 65a6fc7b72128447ad32024e
 *         title:
 *           type: string
 *           example: Sample Content
 *         likes:
 *           type: array
 *           items:
 *             type: string
 *           example: ["65a8025e3af4e7929b379e7b"]
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     description: Retrieves a list of all users in the system. Requires authentication.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.route('/').get(getUser);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Register a new user
 *     description: Registers a new user and sends a verification email with a code.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - country
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *               country:
 *                 type: string
 *                 example: USA
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Optional profile image
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully. Verification code sent to email.
 *                 userId:
 *                   type: string
 *                   example: 65a8025e3af4e7929b379e7b
 *       400:
 *         description: Missing fields or user already exists
 *       500:
 *         description: Server error
 */
router.route('/').post(upload.single('image'), registerUser);

/**
 * @swagger
 * /api/users/verify-email:
 *   post:
 *     summary: Verify user email
 *     description: Verifies a user's email using the provided verification code.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - verificationCode
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 65a8025e3af4e7929b379e7b
 *               verificationCode:
 *                 type: string
 *                 example: ABC123
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email verified successfully
 *       400:
 *         description: Invalid or expired verification code
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/verify-email', verifyEmail);

/**
 * @swagger
 * /api/users/reverify:
 *   post:
 *     summary: Resend verification code
 *     description: Resends a new verification code to the user's email.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Verification code resent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Verification code resent successfully
 *       400:
 *         description: Email already verified or missing
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/reverify', resendVerificationCode);

/**
 * @swagger
 * /api/users/create:
 *   post:
 *     summary: Create a new user (admin)
 *     description: Creates a new user with the specified role. Requires admin authentication.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *               role:
 *                 type: string
 *                 example: creator
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing fields or user already exists
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.route('/create').post(protect, createUser);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Authenticate a user
 *     description: Logs in a user and returns a JWT token.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *     responses:
 *       200:
 *         description: User logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 token:
 *                   type: string
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
router.route('/login').post(loginUser);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     description: Retrieves the profile of the authenticated user.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/profile', protect, getUserprofile);

/**
 * @swagger
 * /api/users/creators:
 *   get:
 *     summary: Get all creators
 *     description: Retrieves a list of users with the 'creator' role.
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of creators
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       404:
 *         description: No creators found
 *       500:
 *         description: Server error
 */
router.route('/creators').get(getCreators);

/**
 * @swagger
 * /api/users/{userId}:
 *   put:
 *     summary: Update user
 *     description: Updates user information such as name, email, or role.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required  content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 example: jane@example.com
 *               role:
 *                 type: string
 *                 example: user
 *               verified:
 *                 type: boolean
 *                 example: true
 *               hasReadPrivacyPolicy:
 *                 type: boolean
 *                 example: true
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/:id').put(protect, upload.single('profileImage'), updateUser); 

/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Delete user
 *     description: Deletes a user and their associated profile image from Cloudinary.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/:userId').delete(protect, deleteUser);

/**
 * @swagger
 * /api/users/like:
 *   post:
 *     summary: Like content
 *     description: Adds a content ID to the authenticated user's likes array and the user ID to the content's likes array.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: 65a6fc7b72128447ad32024e
 *     responses:
 *       200:
 *         description: Content liked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Content liked successfully
 *                 userLikes:
 *                   type: array
 *                   items:
 *                     type: string
 *                 contentLikes:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Content already liked or invalid ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or content not found
 *       500:
 *         description: Server error
 */
router.route('/like').post(protect, likeContent);

/**
 * @swagger
 * /api/users/unlike:
 *   post:
 *     summary: Unlike content
 *     description: Removes a content ID from the authenticated user's likes array and the user ID from the content's likes array.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: 65a6fc7b72128447ad32024e
 *     responses:
 *       200:
 *         description: Content unliked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Content unliked successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 contentId:
 *                   type: string
 *                   example: 65a6fc7b72128447ad32024e
 *       400:
 *         description: Invalid ID or user has not liked this content
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or content not found
 *       500:
 *         description: Server error
 */
router.route('/unlike').post(protect, unlikeContent);

/**
 * @swagger
 * /api/users/likes/{userId}:
 *   get:
 *     summary: Get liked content
 *     description: Retrieves the list of content liked by the user.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: List of liked content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 likedContents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Content'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/likes/:userId').get(protect, getLikedContents);

/**
 * @swagger
 * /api/users/watchlist/{userId}:
 *   post:
 *     summary: Add content to watchlist
 *     description: Adds a content ID to the user's watchlist.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: 65a6fc7b72128447ad32024e
 *     responses:
 *       200:
 *         description: Content added to watchlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Content added to watchlist
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Content already in watchlist
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or content not found
 *       500:
 *         description: Server error
 */
router.route('/watchlist/:userId').post(protect, addWatchlist);

/**
 * @swagger
 * /api/users/watchlist/{userId}:
 *   get:
 *     summary: Get watchlist
 *     description: Retrieves the user's watchlist.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string 
 *         description: User ID
 *     responses:
 *       200:
 *         description: User's watchlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 watchlist:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Content'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/watchlist/:userId').get(protect, getWatchlist);

/**
 * @swagger
 * /api/users/watchlist/{userId}/remove:
 *   post:
 *     summary: Remove content from watchlist
 *     description: Removes a content ID from the user's watchlist.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: 65a6fc7b72128447ad32024e
 *     responses:
 *       200:
 *         description: Content removed from watchlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
ны
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Content removed from watchlist
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or content not found
 *       500:
 *         description: Server error
 */
router.route('/watchlist/:userId/remove').post(protect, removeWatchlist);

/**
 * @swagger
 * /api/users/history/{userId}:
 *   post:
 *     summary: Save content to history
 *     description: Adds a content ID to the user's viewing history.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *             properties:
 *               contentId:
 *                 type: string
 *                 example: 65a6fc7b72128447ad32024e
 *     responses:
 *       200:
 *         description: Content added to history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Content added to history
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or content not found
 *       500:
 *         description: Server error
 */
router.route('/history/:userId').post(protect, saveContentToHistory);

/**
 * @swagger
 * /api/users/history/{userId}:
 *   get:
 *     summary: Get user history
 *     description: Retrieves the user's content viewing history.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User's viewing history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 history:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Content'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/history/:userId').get(protect, getUserHistory);

/**
 * @swagger
 * /api/users/policy/{userId}:
 *   patch:
 *     summary: Mark privacy policy as read
 *     description: Marks the privacy policy as read for the authenticated user.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Privacy policy marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Privacy policy marked as read
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.route('/policy/:userId').patch(protect, markPrivacyPolicyAsRead);

module.exports = router;