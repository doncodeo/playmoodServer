
const asyncHandler = require ('express-async-handler');
// const userSchema = require('../models/userModel');
const userData = require('../models/userModel');
const contentSchema = require('../models/contentModel');
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");               
const cloudinary = require('../config/cloudinary');
const Token = require("../models/token");
const crypto = require("crypto");
const { verifyEmail } = require('../middleware/authmiddleware');
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
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            res.status(400).json({ error: 'Important fields missing!' });
            return;
        }

        // Check for existing user
        const userExist = await userData.findOne({ email });

        if (userExist) {
            console.log("User already exists", email);
            res.status(400);
            throw new Error("User already exists!!!");
        }

        // Hash password
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);

        // Set default values for profileImage and cloudinary_id
        const defaultProfileImage = 'https://t3.ftcdn.net/jpg/05/16/27/58/360_F_516275801_f3Fsp17x6HQK0xQgDQEELoTuERO4SsWV.jpg'; // Replace with your default image URL
        const defaultCloudinaryId = 'user-uploads/qdayeocck7k6zzqqery15'; // Replace with your default cloudinary_id

        // Create user with default profile image and cloudinary_id
        const user = await userData.create({
            name,
            email,
            password: hashedPassword,
            profileImage: defaultProfileImage,
            cloudinary_id: defaultCloudinaryId,
        });

        if (user) {
            console.log('User created:', user.email);
            res.status(201).json({ user });

            // Send registration confirmation email
            const mailOptions = {
                from: `"PlaymoodTV 📺" <${process.env.EMAIL_USERNAME}>`,
                to: user.email,
                subject: 'Registration Confirmation',
                html: `
                    <html>
                        <head>
                            <style>
                                body {
                                    font-family: Arial, sans-serif;
                                    background-color: #f0f0f0;
                                    color: #333;
                                    padding: 20px;
                                }
                                .container {
                                    max-width: 600px;
                                    margin: 0 auto;
                                    background-color: #ffffff;
                                    padding: 20px;
                                    border-radius: 8px;
                                    box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
                                }
                                .header {
                                    background-color: tomato;
                                    color: white;
                                    padding: 10px;
                                    text-align: center;
                                    border-top-left-radius: 8px;
                                    border-top-right-radius: 8px;
                                }
                                .content {
                                    padding: 20px;
                                }
                                .login-button {
                                    display: inline-block;
                                    padding: 10px 20px;
                                    background-color: tomato;
                                    color: white;
                                    text-decoration: none;
                                    border-radius: 5px;
                                }
                                .footer {
                                    margin-top: 20px;
                                    text-align: center;
                                    color: #666;
                                    font-size: 12px;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h2>Welcome to PlaymoodTV!</h2>
                                </div>
                                <div class="content">
                                    <p>Dear ${user.name},</p>
                                    <p>Thank you for registering with PlaymoodTV! We're excited to have you on board.</p>
                                    <p>Please use the following button to log in to your account:</p>
                                    <a class="login-button" href="http://localhost:3000/login" target="_blank">Login to Your Account</a>
                                    <p>We look forward to providing you with the best entertainment experience.</p>
                                </div>
                                <div class="footer">
                                    <p>Best regards,</p>
                                    <p>The PlaymoodTV Team</p>
                                </div>
                            </div>
                        </body>
                    </html>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("Error sending email:", error);
                } else {
                    console.log('Email sent:', info.response);
                }
            });

        } else {
            console.log('User creation failed');
            res.status(400);
            throw new Error('Invalid user data');
        }

        console.log('User registration completed'); // Log exit point

    } catch (error) {
        console.error(error); // Log any errors to the console for debugging
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


const updateUser = asyncHandler(async (req, res) => {
    try {
        const userId = req.params.id; // Assuming the user ID is passed as a parameter

        // Fetch the user from MongoDB
        const user = await userSchema.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if a file is present in the request
        if (req.file) {
            // Upload the new profile image to Cloudinary
            const updatedCloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
                folder: 'user-uploads',
                public_id: user._id, // Set public_id to a unique identifier like user._id
            });

            // If updating the profile image, delete the old image in Cloudinary
            if (user.cloudinary_id) {
                await cloudinary.uploader.destroy(user.cloudinary_id);
            }

            // Update the user's profileImage and cloudinary_id
            user.profileImage = updatedCloudinaryResult.secure_url;
            user.cloudinary_id = updatedCloudinaryResult.public_id;
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
                profileImage: updatedUser.profileImage,
                cloudinary_id: updatedUser.cloudinary_id,
                verified: updatedUser.verified,
                hasReadPrivacyPolicy: updatedUser.hasReadPrivacyPolicy
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});



// const updateUser = asyncHandler(async (req, res) => {
//     try {
//         const userId = req.params.id; // Assuming the user ID is passed as a parameter

//         // Fetch the user from MongoDB
//         const user = await userData.findById(userId);

//         if (!user) {
//             res.status(404).json({ error: 'User not found' });
//             return;
//         }

//         // Check if a file is present in the request
//         if (req.file) {
//             // Update the user's profile image in Cloudinary
//             const updatedCloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
//                 folder: 'user-uploads',
//                 public_id: user._id, // Set public_id to a unique identifier like user._id
//             });

//             // If updating the profile image, delete the old image in Cloudinary
//             if (user.cloudinary_id) {
//                 await cloudinary.uploader.destroy(user.cloudinary_id);
//             }

//             // Update the user's profileImage and cloudinary_id
//             user.profileImage = updatedCloudinaryResult.secure_url;
//             user.cloudinary_id = updatedCloudinaryResult.public_id;
//         }

//         // Store the previous role before updating
//         const previousRole = user.role;

//         // Update other user data in MongoDB using mapping method
//         const allowedFields = ['name', 'email', 'role', 'verified', 'hasReadPrivacyPolicy'];
//         allowedFields.forEach(field => {
//             if (req.body[field] !== undefined) {
//                 user[field] = req.body[field];
//             }
//         });

//         // Save the updated user in MongoDB
//         const updatedUser = await user.save();

//         // If the role is updated, check and update the RoleChangeRequest table
//         if (req.body.role && req.body.role !== previousRole) {
//             const roleChangeRequest = await RoleChangeRequest.findOne({ user: userId });

//             if (req.body.role === 'creator' && roleChangeRequest && roleChangeRequest.status === 'pending') {
//                 roleChangeRequest.status = 'approved';
//                 await roleChangeRequest.save();
//             } else if (previousRole === 'creator' && roleChangeRequest && roleChangeRequest.status === 'approved') {
//                 roleChangeRequest.status = 'pending';
//                 await roleChangeRequest.save();
//             }
//         }

//         res.status(200).json({
//             message: 'User updated successfully',
//             user: {
//                 _id: updatedUser._id,
//                 name: updatedUser.name,
//                 email: updatedUser.email,
//                 role: updatedUser.role,
//                 profileImage: updatedUser.profileImage,
//                 cloudinary_id: updatedUser.cloudinary_id,
//                 verified: updatedUser.verified,
//                 hasReadPrivacyPolicy: updatedUser.hasReadPrivacyPolicy
//             },
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Server error' });
//     }
// });





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

const getUserprofile = asyncHandler( async (req, res) => {
    const {_id, name, email, profileImage, role} = await userData.findById(req.user.id)
    res.status(200).json({
     id:_id,
     name,
     email,
     role,
     profileImage
    })
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
        // const userId = req.body.userId;
        const userId = req.params.id; // Access userId from URL parameter
  

        // Check if the user has already liked the content
        const user = await userData.findOne({ _id: userId, likes: contentId });

        if (user) {
            return res.status(400).json({ error: 'This user already liked this content' });
        }

        // Find the user by ID and update the likes array
        const updatedUser = await userData.findByIdAndUpdate(
            userId,
            { $push: { likes: contentId } },
            { new: true }
        );

        // res.status(200).json({ likes: updatedUser, message: "User successfully like content" });
        res.status(200).json({ contentId: contentId, message: "User successfully liked content" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @desc PUT Content
// @route PUT /api/user/unlike/:id
// @route PUT /api/user/unlike/id

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
    getCreators,
    createUser,
    loginUser,
    getUserprofile,
    updateUser,
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
