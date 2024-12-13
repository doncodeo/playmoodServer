
const asyncHandler = require ('express-async-handler');
// const userSchema = require('../models/userModel');
const userData = require('../models/userModel');
const contentSchema = require('../models/contentModel');
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");               
const cloudinary = require('../config/cloudinary');
const Token = require("../models/token");
const crypto = require("crypto");
// const { verifyEmail } = require('../middleware/authmiddleware');
const nodemailer = require('nodemailer');
const RoleChangeRequest = require('../models/roleChangeModel');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

const getUser = asyncHandler(async (req, res) => {
      
    const users = await userData.find()

    res.status(200).json(users)
})


// @desc Register new users
// @route post /api/users
// @access Public

const registerUser = asyncHandler(async (req, res) => {
    try {
        const { name, email, password} = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Important fields are missing!' });
        }

        // Check for existing user
        const userExist = await userData.findOne({ email });
        if (userExist) {
            return res.status(400).json({ error: "User already exists!" });
        }

        // Hash password
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);

        // Generate email verification code and expiration
        const emailVerificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
        const emailVerificationExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

        const defaultProfileImage = 'https://t3.ftcdn.net/jpg/05/16/27/58/360_F_516275801_f3Fsp17x6HQK0xQgDQEELoTuERO4SsWV.jpg';
        const defaultCloudinaryId = 'user-uploads/qdayeocck7k6zzqqery15';

        const user = await userData.create({
            name,
            email,
            password: hashedPassword,
            country,
            emailVerificationCode,
            emailVerificationExpires,
            profileImage: defaultProfileImage,
            cloudinary_id: defaultCloudinaryId,
        });

        if (user) {
            // Send verification email
            const mailOptions = {
                from: `"PlaymoodTV 📺" <${process.env.EMAIL_USERNAME}>`,
                to: user.email,
                subject: 'Email Verification Code',
                html: `
                    <html>
                        <body>
                            <p>Hello ${user.name},</p>
                            <p>Your verification code is: <strong>${emailVerificationCode}</strong></p>
                            <p>This code will expire in 15 minutes.</p>
                            <p>Best regards,</p>
                            <p>The PlaymoodTV Team</p>
                        </body>
                    </html>
                `,
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("Error sending email:", error);
                    return res.status(500).json({ error: 'Error sending email' });
                } else {
                    console.log('Verification email sent:', info.response);
                    return res.status(201).json({ message: 'Verification code sent to email', userId: user._id });
                }
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Verify email endpoint
const verifyEmail = asyncHandler(async (req, res) => {
    const { userId, verificationCode } = req.body;

    if (!userId || !verificationCode) {
        return res.status(400).json({ error: 'Missing user ID or verification code' });
    }

    try {
        const user = await userData.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        if (user.emailVerificationExpires < Date.now()) {
            return res.status(400).json({ error: 'Verification code has expired' });
        }

        if (user.emailVerificationCode !== verificationCode) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Mark email as verified
        user.isEmailVerified = true;
        user.emailVerificationCode = null;
        user.emailVerificationExpires = null;
        await user.save();

        // Send confirmation email
        const mailOptions = {
            from: `"PlaymoodTV 📺" <${process.env.EMAIL_USERNAME}>`,
            to: user.email,
            subject: 'Email Verification Successful',
            html: `
                <html>
                    <body>
                        <p>Dear ${user.name},</p>
                        <p>Congratulations! Your email has been successfully verified. You can now enjoy the full PlaymoodTV experience, including accessing our amazing content and engaging with the community.</p>
                        <p>Click the button below to start exploring:</p>
                        <a href="https://playmoodtv.com/" style="display: inline-block; padding: 10px 20px; background-color: tomato; color: white; text-decoration: none; border-radius: 5px;">Explore PlaymoodTV</a>
                        <p>We’re thrilled to have you on board and look forward to providing you with the best entertainment experience possible.</p>
                        <p>Best regards,</p>
                        <p>The PlaymoodTV Team</p>
                    </body>
                </html>
            `,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email:", error);
            } else {
                console.log('Confirmation email sent:', info.response);
            }
        });

        return res.status(200).json({ message: 'Email verified successfully and confirmation email sent.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});


const resendVerificationCode = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const user = await userData.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        // Generate new verification code and expiration
        const emailVerificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
        const emailVerificationExpires = Date.now() + 15 * 60 * 1000;

        user.emailVerificationCode = emailVerificationCode;
        user.emailVerificationExpires = emailVerificationExpires;
        await user.save();

        // Send verification email
        const mailOptions = {
            from: `"PlaymoodTV 📺" <${process.env.EMAIL_USERNAME}>`,
            to: user.email,
            subject: 'Resent Verification Code',
            html: `
                <html>
                    <body>
                        <p>Hello ${user.name},</p>
                        <p>Your new verification code is: <strong>${emailVerificationCode}</strong></p>
                        <p>This code will expire in 15 minutes.</p>
                        <p>Best regards,</p>
                        <p>The PlaymoodTV Team</p>
                    </body>
                </html>
            `,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email:", error);
                return res.status(500).json({ error: 'Error sending email' });
            } else {
                return res.status(200).json({ message: 'Verification code resent successfully' });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});


// @desc Delete user
// @route post /api/users/:id
// @access Public

const deleteUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id; // Assuming the user ID is passed as a parameter

    // Fetch the user from MongoDB
    const user = await userData.findById(userId); 

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Delete the user's profile image from Cloudinary
    const publicId = user.profileImage && user.cloudinary_id;
    // console.log('Before image deletion - Public ID:', publicId);
    if (publicId) {

      await cloudinary.uploader.destroy(publicId);
    }
    // Delete the user from MongoDB
    await user.deleteOne();

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @desc Update user
// @route post /api/users/:id
// @access Public




const updateProfileImage = asyncHandler(async (req, res) => {
    try {
        // const userId = req.user.id; // Assuming you're using some authentication middleware that sets req.user
        const userId = req.params.id; // Assuming the user ID is passed as a parameter
        const file = req.file;

        // Get the user's current profile image details
        const user = await userData.findById(userId);

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Upload image to Cloudinary
        const result = await cloudinary.uploader.upload(file.path, {
            folder: 'user-uploads', // Optional folder
            // public_id: user._id, // Set public_id to a unique identifier like user._id
            public_id: `${userId}-${Date.now()}` // Unique ID for the image
        });

 

        // Delete the old profile image from Cloudinary if it exists
        if (user.cloudinary_id) {
            await cloudinary.uploader.destroy(user.cloudinary_id);
        }

        // Update user profile with new image URL and Cloudinary ID
        user.profileImage = result.secure_url;
        user.cloudinary_id = result.public_id;
        await user.save();

        res.status(200).json({ message: 'Profile image updated successfully', profileImage: user.profileImage });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

const updateUser = asyncHandler(async (req, res) => {
    try {
        const userId = req.params.id; // Assuming the user ID is passed as a parameter

        // Fetch the user from MongoDB
        const user = await userData.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update other user data in MongoDB using mapping method
        const allowedFields = ['name', 'email', 'role', 'verified', 'hasReadPrivacyPolicy'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
            }
        });

        // Save the updated user in MongoDB
        const updatedUser = await user.save();

        res.status(200).json({
            message: 'User updated successfully',
            user: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                profileImage: updatedUser.profileImage, // Retain current profile image
                cloudinary_id: updatedUser.cloudinary_id, // Retain current cloudinary ID
                verified: updatedUser.verified,
                hasReadPrivacyPolicy: updatedUser.hasReadPrivacyPolicy
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});


const createUser = asyncHandler(async (req, res) => {
    try {
        const {name, email, password, role} = req.body
        
        if (!name || !email || !password || !role) {
          
            res.status(400).json({ error: 'important fields missing!' });
            return;
        }

        // check for existing user
        const userExist = await userData.findOne({email})
  
        if(userExist){
            console.log("User already exist", email);
            res.status(400);
            throw new Error ("User already exist!!!")
        }

        // Hash password 
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);
        console.log(hashedPassword)

        // create user
        const user = await userData.create({
            name,
            email,
            password:hashedPassword,
            role
        })

        if (user) {
            console.log('User created:', user.email);
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, user.role)
            });
        } else {
            console.log('User creation failed');
            res.status(400);
            throw new Error('Invalid user data');
        }

        console.log('User Created successfully completed'); // Log exit point

    } catch (error) {
        console.error(error); // Log any errors to the console for debugging
        res.status(500).json({ error: 'Server error' });
    }
}); 

// @desc Authenticate a user
// @route POST /api/users/login
// @access Public

const loginUser = asyncHandler(async (req, res) => {
    const {email, password} = req.body;
    // console.log(email)

    // check for user email
    const user = await userData.findOne({email});


    if(user && (await bcryptjs.compare(password, user.password))) {
//   console.log('User found during login:', user); // Add this log statement
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            like: user.likes,
            watchlist: user.watchlist,
            profile: user.profileImage,
            token: generateToken(user._id, user.role)
        });
        res.json({data});
    }else {
        res.status(404).json({ error: 'User not found or invalid credentials' });

    }
});

// @desc Get user profile 
// @route GET/api/users/profile
// @access Public

const getUserprofile = asyncHandler(async (req, res) => {
    const user = await userData.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    res.status(200).json({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
    });
});



 const getCreators = asyncHandler(async (req, res) => {
    try {
        const creators = await userData.find({ role: 'creator' });

        if (creators.length === 0) {
            return res.status(404).json({ message: 'No creators found' });
        }

        res.status(200).json(creators);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

 // @desc PUT Content
// @route PUT /api/user/like/:id (user id) push the content id  {"contentId": "65a6fc7b72128447ad32024e", "userId": "65a8025e3af4e7929b379e7b"}

const likeContent = asyncHandler(async (req, res) => {
    try {
        const contentId = req.body.contentId;
        const userId = req.params.id; // Access userId from URL parameter

        // Check if the user has already liked the content (from the user's `likes` array)
        const user = await userData.findOne({ _id: userId, likes: contentId });
        if (user) {
            return res.status(400).json({ error: 'This user already liked this content' });
        }

        // Check if the content exists and if the user has already liked it (from the content's `likes` array)
        const content = await contentSchema.findOne({ _id: contentId, likes: userId });
        if (content) {
            return res.status(400).json({ error: 'This content is already liked by the user' });
        }

        // Add the content to the user's likes array
        const updatedUser = await userData.findByIdAndUpdate(
            userId,
            { $push: { likes: contentId } },
            { new: true }
        );

        // Add the user to the content's likes array
        const updatedContent = await contentSchema.findByIdAndUpdate(
            contentId,
            { $push: { likes: userId } },
            { new: true }
        );

        res.status(200).json({ 
            message: "User successfully liked content", 
            userLikes: updatedUser.likes, 
            contentLikes: updatedContent.likes 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// const likeContent = asyncHandler(async (req, res) => {
//     try {
//         const contentId = req.body.contentId;
//         // const userId = req.body.userId;
//         const userId = req.params.id; // Access userId from URL parameter
  

//         // Check if the user has already liked the content
//         const user = await userData.findOne({ _id: userId, likes: contentId });

//         if (user) {
//             return res.status(400).json({ error: 'This user already liked this content' });
//         }

//         // Find the user by ID and update the likes array
//         const updatedUser = await userData.findByIdAndUpdate(
//             userId,
//             { $push: { likes: contentId } },
//             { new: true }
//         );

//         // res.status(200).json({ likes: updatedUser, message: "User successfully like content" });
//         res.status(200).json({ contentId: contentId, message: "User successfully liked content" });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Server error' });
//     }
// });

const unlikeContent = asyncHandler(async (req, res) => {
    try {
        const contentId = req.body.contentId;
        const userId = req.params.id; // Access userId from URL parameter

        // const userId = req.body.userId;

        // Find the user by ID and update the likes array to remove the contentId
        const updatedUser = await userData.findByIdAndUpdate(
            userId,
            { $pull: { likes: contentId } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found'});
        }

        // res.status(200).json({ likes: updatedUser.likes, message: "user unliked content"  }); 
        res.status(200).json({ contentId: contentId, message: "User unliked this content" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error'});
    }
});  

// @desc GET Content
// @route GET /api/user/getlike/:id for body
// @route GET /api/user/getlike/id for params

const getLikedContents = asyncHandler(async (req, res) => {
    // const userId = req.body.userId; dont ever use this method to req from FE lol although it works for BE
    const userId = req.params.id; // Access userId from URL parameter

    try {
        const user = await userData.findById(userId).populate('likes');
        res.status(200).json({ likedContents: user.likes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

 // @desc PUT Content
// @route PUT /api/user/watchlist/:id (user id) push the content id  {"contentId": "65a6fc7b72128447ad32024e", "userId": "65a8025e3af4e7929b379e7b"}

const addWatchlist = asyncHandler(async (req, res) => {
    try {
        const contentId = req.body.contentId;
        // const userId = req.body.userId;
        const userId = req.params.id;


        // Check if the user has already liked the content
        const user = await userData.findOne({ _id: userId, watchlist: contentId });

        if (user) {
            return res.status(400).json({ error: 'This content already exist on users watchlist' });
        }

        // Find the user by ID and update the likes array
        const updatedUser = await userData.findByIdAndUpdate(
            userId,
            { $push: { watchlist: contentId } },
            { new: true }
        );

        // res.status(200).json({ watchlist: updatedUser.watchlist, message: "Content successfully added to Watchlist" });
        res.status(200).json({ contentId: contentId, message: "Content added to watchlist!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc GET Content
// @route GET /api/user/getlike/:id

const getWatchlist = asyncHandler(async (req, res) => {
    // const userId = req.body.userId;
    const userId = req.params.id;

    try {
        const user = await userData.findById(userId).populate('watchlist');
        res.status(200).json({ watchList: user.watchlist });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc PUT Content
// @route PUT /api/user/removelist/:id
const removeWatchlist = asyncHandler(async (req, res) => {
    try {
        const contentId = req.body.contentId;
        // const userId = req.body.userId;
        const userId = req.params.id;


        // Find the user by ID and update the likes array to remove the contentId
        const updatedUser = await userData.findByIdAndUpdate(
            userId,
            { $pull: { watchlist: contentId } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: 'User/Content not found' });
        }

        // res.status(200).json({ watchlist: updatedUser.watchlist, message:"Content removed from watchlist!" });
        res.status(200).json({ contentId: contentId, message: "Content removed to watchlist!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error', message: "watchlist successfully removed!" });
    }
});

/**
 * @route   PUT /api/user/:userId/save-content/:contentId
 * @desc    Save a content to user's history
 * @access  Private
 */
const saveContentToHistory = asyncHandler(async (req, res) => {
    const userId = req.body.userId;
    const contentId = req.body.contentId;

    try {
        // Find the user by ID and update the history array
        const updatedUser = await userData.findByIdAndUpdate(
            userId,
            { $push: { history: contentId } },
            { new: true }
        );

        res.status(200).json({ history: updatedUser.history });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * @route   GET /api/user/:userId/history
 * @desc    Get user's content viewing history
 * @access  Public
 */
const getUserHistory = asyncHandler(async (req, res) => {
    const userId = req.body.userId;

    try {
        const user = await userData.findById(userId).populate('history');
        res.status(200).json({ history: user.history });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

const markPrivacyPolicyAsRead = asyncHandler(async (req, res) => {
    const userId = req.user.id; // Assuming user is authenticated and user id is available in req.user

    if (!userId) {
        res.status(400).json({ message: 'User ID is required' });
        return;
    }

    try {
        const user = await userData.findById(userId);
        

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        user.hasReadPrivacyPolicy = true;
        await user.save();
        res.status(200).json({ message: 'Privacy policy marked as read' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
 
 module.exports = {
    getUser, 
    registerUser,
    verifyEmail,
    resendVerificationCode,
    getCreators,
    createUser,
    loginUser,
    getUserprofile,
    updateUser,
    updateProfileImage,
    deleteUser,
    likeContent,
    unlikeContent,
    getLikedContents,
    addWatchlist,
    getWatchlist,
    removeWatchlist,
    saveContentToHistory,
    getUserHistory,
    markPrivacyPolicyAsRead 
 }
