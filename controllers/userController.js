
const asyncHandler = require ('express-async-handler'); 
// const userSchema = require('../models/userModel');
const userData = require('../models/userModel');
const contentSchema = require('../models/contentModel');
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const cloudinary = require('../config/cloudinary');
const Token = require("../models/token");
const crypto = require("crypto");
const DatauriParser = require('datauri/parser');
const path = require('path');
const transporter = require('../utils/mailer');
// const { verifyEmail } = require('../middleware/authmiddleware');
const nodemailer = require('nodemailer');
const RoleChangeRequest = require('../models/roleChangeModel');
const mongoose = require('mongoose');
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
        const { name, email, password, country} = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Important fields are missing!' });
        }

        // Check if the user already exists
        const userExist = await userData.findOne({ email });
        if (userExist) {
            return res.status(400).json({ error: "User already exists!" });
        }

        // Hash the user's password
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);

        // Generate email verification code and expiration time
        const emailVerificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
        const emailVerificationExpires = Date.now() + 15 * 60 * 1000; // Expires in 15 minutes

        // Default profile image and Cloudinary ID
        const defaultProfileImage = 'https://t3.ftcdn.net/jpg/05/16/27/58/360_F_516275801_f3Fsp17x6HQK0xQgDQEELoTuERO4SsWV.jpg';
        const defaultCloudinaryId = 'user-uploads/qdayeocck7k6zzqqery15';

        // Create the new user
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
            // Send the verification email
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
                    return res.status(500).json({ error: 'Failed to send the verification email.' });
                } else {
                    console.log('Verification email sent:', info.response);

                    // Success response with a clear message
                    return res.status(201).json({
                        message: 'User registered successfully. Verification code sent to email.',
                        userId: user._id,
                    });
                }
            });
        } else {
            return res.status(500).json({ error: 'Failed to create user. Please try again.' });
        }
    } catch (error) {
        console.error("Error in user registration:", error);
        res.status(500).json({ error: 'Server error. Please try again later.' });
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

        if (!user || user.isEmailVerified) {
            return res.status(200).json({
                message: 'If your email is registered and unverified, you will receive a new verification code shortly.'
            });
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
                return res.status(200).json({
                    message: 'If your email is registered and unverified, you will receive a new verification code shortly.'
                });
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



// Utility function to format timestamps for logging

// @desc Update user profile
// @route PUT /api/users/:id
// @access Private (authenticated, user or admin)
const getTimestamp = () => new Date().toISOString();

const updateUser = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    // Log request start
    console.log(
        `[${getTimestamp()}] INFO: Update user request started - userId: ${userId}, requesterId: ${
            req.user?.id
        }, ip: ${req.ip}, method: ${req.method}, url: ${req.originalUrl}`
    );

    // Validate req.user (from protect middleware)
    if (!req.user || !req.user.id) {
        console.log(
            `[${getTimestamp()}] WARN: Authenticated user not found in request - userId: ${userId}`
        );
        return res.status(401).json({
            status: 'error',
            error: 'Unauthorized',
            details: 'Authenticated user not found. Please log in again.',
        });
    }

    // Validate userId presence
    if (!userId) {
        console.log(
            `[${getTimestamp()}] WARN: User ID missing in request - requesterId: ${req.user.id}`
        );
        return res.status(400).json({
            status: 'error',
            error: 'Bad Request',
            details: 'User ID is required in the URL path.',
        });
    }

    // Validate userId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
        console.log(
            `[${getTimestamp()}] WARN: Invalid user ID format - userId: ${userId}, requesterId: ${
                req.user.id
            }`
        );
        return res.status(400).json({
            status: 'error',
            error: 'Bad Request',
            details: 'Invalid user ID format. Must be a 24-character hexadecimal string.',
        });
    }

    // Fetch the user
    let user;
    try {
        user = await userData.findById(userId);
    } catch (error) {
        console.error(
            `[${getTimestamp()}] ERROR: Failed to fetch user from database - userId: ${userId}, requesterId: ${
                req.user.id
            }, error: ${error.message}, stack: ${error.stack}`
        );
        return res.status(500).json({
            status: 'error',
            error: 'Database Error',
            details: 'Failed to fetch user due to a database error. Please try again later.',
        });
    }

    if (!user) {
        console.log(
            `[${getTimestamp()}] WARN: User not found - userId: ${userId}, requesterId: ${req.user.id}`
        );
        return res.status(404).json({
            status: 'error',
            error: 'Not Found',
            details: 'User not found with the provided ID.',
        });
    }

    // Check authorization: User can update their own profile, admin can update any
    if (user._id.toString() !== req.user.id && req.user.role !== 'admin') {
        console.log(
            `[${getTimestamp()}] WARN: Unauthorized update attempt - userId: ${userId}, requesterId: ${
                req.user.id
            }, requesterRole: ${req.user.role}`
        );
        return res.status(403).json({
            status: 'error',
            error: 'Forbidden',
            details: 'You are not authorized to update this user’s profile.',
        });
    }

    // Check if at least one field is provided
    if (!req.file && Object.keys(req.body).length === 0) {
        console.log(
            `[${getTimestamp()}] WARN: No fields provided for update - userId: ${userId}, requesterId: ${
                req.user.id
            }`
        );
        return res.status(400).json({
            status: 'error',
            error: 'Bad Request',
            details: 'At least one field must be provided to update the user profile.',
        });
    }

    // Validate social media URLs if provided
    const socialFields = ['instagram', 'tiktok', 'linkedin', 'twitter'];
    const urlRegex = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w- ./?%&=]*)?$/;
    for (const field of socialFields) {
        if (req.body[field] && !urlRegex.test(req.body[field])) {
            console.log(
                `[${getTimestamp()}] WARN: Invalid social media URL - userId: ${userId}, field: ${field}, value: ${
                    req.body[field]
                }`
            );
            return res.status(400).json({
                status: 'error',
                error: 'Bad Request',
                details: `Invalid ${field} URL. Must be a valid URL.`,
            });
        }
    }

    // Validate email format if provided
    if (req.body.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(req.body.email)) {
            console.log(
                `[${getTimestamp()}] WARN: Invalid email format - userId: ${userId}, email: ${
                    req.body.email
                }`
            );
            return res.status(400).json({
                status: 'error',
                error: 'Bad Request',
                details: 'Invalid email format.',
            });
        }
    }

    // Define allowed fields for update
    const allowedFields = [
        'name',
        'email',
        'country',
        'about',
        'hasReadPrivacyPolicy',
        'instagram',
        'tiktok',
        'linkedin',
        'twitter',
    ];

    // Admin-only fields
    if (req.user.role === 'admin') {
        allowedFields.push('role', 'isEmailVerified');
    }

    // Validate allowed fields in req.body
    const providedFields = Object.keys(req.body);
    const invalidFields = providedFields.filter(field => !allowedFields.includes(field));
    if (invalidFields.length > 0) {
        console.log(
            `[${getTimestamp()}] WARN: Attempt to update restricted fields - userId: ${userId}, invalidFields: ${invalidFields.join(
                ', '
            )}`
        );
        return res.status(400).json({
            status: 'error',
            error: 'Bad Request',
            details: `Cannot update restricted fields: ${invalidFields.join(', ')}.`,
        });
    }

    // Check email uniqueness if email is updated
    if (req.body.email && req.body.email !== user.email) {
        try {
            const emailExists = await userData.findOne({ email: req.body.email });
            if (emailExists) {
                console.log(
                    `[${getTimestamp()}] WARN: Email already in use - userId: ${userId}, email: ${
                        req.body.email
                    }`
                );
                return res.status(400).json({
                    status: 'error',
                    error: 'Bad Request',
                    details: 'Email is already in use by another user.',
                });
            }
        } catch (error) {
            console.error(
                `[${getTimestamp()}] ERROR: Failed to check email uniqueness - userId: ${userId}, email: ${
                    req.body.email
                }, error: ${error.message}, stack: ${error.stack}`
            );
            return res.status(500).json({
                status: 'error',
                error: 'Database Error',
                details: 'Failed to check email uniqueness due to a database error.',
            });
        }
    }

    // Update fields from req.body
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            user[field] = req.body[field];
        }
    });

    // Handle profile image upload
    if (req.file) {
        try {
            const parser = new DatauriParser();
            const fileExtension = path.extname(req.file.originalname).toString();
            const fileBuffer = req.file.buffer;
            const file64 = parser.format(fileExtension, fileBuffer);

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(file64.mimetype)) {
                console.log(
                    `[${getTimestamp()}] WARN: Invalid file type for profile image - userId: ${userId}, mimetype: ${
                        file64.mimetype
                    }`
                );
                return res.status(400).json({
                    status: 'error',
                    error: 'Bad Request',
                    details: 'Profile image must be a JPEG, PNG, or GIF file.',
                });
            }

            // Upload new image to Cloudinary
            const result = await cloudinary.uploader.upload(file64.content, {
                folder: 'profile-images',
                public_id: `${userId}-${Date.now()}`,
            });

            // Delete old image from Cloudinary if it exists
            if (user.cloudinary_id) {
                try {
                    await cloudinary.uploader.destroy(user.cloudinary_id);
                    console.log(
                        `[${getTimestamp()}] INFO: Old Cloudinary image deleted - userId: ${userId}, cloudinaryId: ${
                            user.cloudinary_id
                        }`
                    );
                } catch (error) {
                    console.log(
                        `[${getTimestamp()}] WARN: Failed to delete old Cloudinary image - userId: ${userId}, cloudinaryId: ${
                            user.cloudinary_id
                        }, error: ${error.message}`
                    );
                }
            }

            // Update profile image and Cloudinary ID
            user.profileImage = result.secure_url;
            user.cloudinary_id = result.public_id;
        } catch (error) {
            // Handle specific Cloudinary errors
            let errorMessage = 'Failed to upload profile image.';
            if (error.http_code === 429) {
                errorMessage = 'Cloudinary rate limit exceeded. Please try again later.';
            } else if (error.http_code === 400) {
                errorMessage = 'Invalid image file provided to Cloudinary.';
            }

            console.error(
                `[${getTimestamp()}] ERROR: Cloudinary upload failed - userId: ${userId}, error: ${
                    error.message || 'Unknown error'
                }, stack: ${error.stack}`
            );
            return res.status(500).json({
                status: 'error',
                error: 'Upload Error',
                details: errorMessage,
            });
        }
    }

    // Save the updated user
    let updatedUser;
    try {
        updatedUser = await user.save();
        console.log(
            `[${getTimestamp()}] INFO: User updated successfully - userId: ${userId}, updatedFields: ${Object.keys(
                req.body
            ).join(', ')}${req.file ? ', profileImage' : ''}`
        );
    } catch (error) {
        console.error(
            `[${getTimestamp()}] ERROR: Failed to save user updates - userId: ${userId}, error: ${
                error.message
            }, stack: ${error.stack}`
        );
        return res.status(500).json({
            status: 'error',
            error: 'Database Error',
            details: 'Failed to save user updates due to a database error.',
        });
    }

    // Prepare response
    res.status(200).json({
        message: 'User updated successfully',
        user: {
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            profileImage: updatedUser.profileImage,
            cloudinary_id: updatedUser.cloudinary_id,
            country: updatedUser.country,
            isEmailVerified: updatedUser.isEmailVerified,
            hasReadPrivacyPolicy: updatedUser.hasReadPrivacyPolicy,
            about: updatedUser.about,
            instagram: updatedUser.instagram,
            tiktok: updatedUser.tiktok,
            linkedin: updatedUser.linkedin,
            twitter: updatedUser.twitter,
        },
    });
});



// const updateUser = asyncHandler(async (req, res) => {
//     try {
//         const userId = req.params.id; // Assuming the user ID is passed as a parameter

//         // Fetch the user from MongoDB
//         const user = await userData.findById(userId);

//         if (!user) {
//             return res.status(404).json({ error: 'User not found' });
//         }

//         // Update other user data in MongoDB using mapping method
//         const allowedFields = ['name', 'email', 'role', 'verified', 'hasReadPrivacyPolicy'];
//         allowedFields.forEach(field => {
//             if (req.body[field] !== undefined) {
//                 user[field] = req.body[field];
//             }
//         });

//         // Save the updated user in MongoDB
//         const updatedUser = await user.save();

//         res.status(200).json({
//             message: 'User updated successfully',
//             user: {
//                 _id: updatedUser._id,
//                 name: updatedUser.name,
//                 email: updatedUser.email,
//                 role: updatedUser.role,
//                 profileImage: updatedUser.profileImage, // Retain current profile image
//                 cloudinary_id: updatedUser.cloudinary_id, // Retain current cloudinary ID
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

    if (user && !user.password) {
        return res.status(400).json({
            error: 'You have previously signed in with Google. Please use Google Sign-In to continue.',
            googleSignIn: true
        });
    }


    if(user && (await bcryptjs.compare(password, user.password))) {
//   console.log('User found during login:', user); // Add this log statement
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileImage: user.profileImage,
            cloudinary_id: user.cloudinary_id,
            likes: user.likes,
            watchlist: user.watchlist,
            history: user.history,
            verified: user.isEmailVerified,
            hasReadPrivacyPolicy: user.hasReadPrivacyPolicy,
            token: generateToken(user._id, user.role)
        });
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
        country: user.country,
        isEmailVerified: user.isEmailVerified,
        likes: user.likes,
        watchlist: user.watchlist,
        history: user.history,
        hasReadPrivacyPolicy: user.hasReadPrivacyPolicy,
        subscriptions: user.subscriptions,
        subscribers: user.subscribers,
        about: user.about,
        bannerImage: user.bannerImage,
        communityPosts: user.communityPosts,
        playlists: user.playlists,
        videoProgress: user.videoProgress,
        instagram: user.instagram,
        tiktok: user.tiktok,
        linkedin: user.linkedin,
        twitter: user.twitter,
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
        const userId = req.user.id; // Use req.user.id from protect middleware

        // Log for debugging
        console.log({ userId, contentId });

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        if (!mongoose.Types.ObjectId.isValid(contentId)) {
            return res.status(400).json({ error: 'Invalid content ID' });
        }

        // Check if the user exists
        const user = await userData.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if the content exists
        const content = await contentSchema.findById(contentId);
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Check if the user has already liked the content
        if (user.likes.includes(contentId)) {
            return res.status(400).json({ error: 'This user already liked this content' });
        }

        // Check if the content has the user in its likes array
        if (content.likes.includes(userId)) {
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

        // Check if updates were successful
        if (!updatedUser || !updatedContent) {
            return res.status(500).json({ error: 'Failed to update likes' });
        }

        res.status(200).json({ 
            message: "User successfully liked content", 
            userLikes: updatedUser.likes, 
            contentLikes: updatedContent.likes 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});


const unlikeContent = asyncHandler(async (req, res) => {
    try {
        const contentId = req.body.contentId;
        const userId = req.user.id; // Use authenticated user's ID from protect middleware

        console.log({ userId, contentId }); // Debug

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        if (!mongoose.Types.ObjectId.isValid(contentId)) {
            return res.status(400).json({ error: 'Invalid content ID' });
        }

        // Check if the user exists
        const user = await userData.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if the content exists
        const content = await contentSchema.findById(contentId);
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Check if the user has liked the content
        if (!user.likes.includes(contentId)) {
            return res.status(400).json({ error: 'User has not liked this content' });
        }

        // Remove the content from the user's likes array
        const updatedUser = await userData.findByIdAndUpdate(
            userId,
            { $pull: { likes: contentId } },
            { new: true }
        );

        // Remove the user from the content's likes array
        const updatedContent = await contentSchema.findByIdAndUpdate(
            contentId,
            { $pull: { likes: userId } },
            { new: true }
        );

        // Check if updates were successful
        if (!updatedUser || !updatedContent) {
            return res.status(500).json({ error: 'Failed to update likes' });
        }

        res.status(200).json({
            message: 'Content unliked successfully',
            user: updatedUser, // Align with Swagger documentation
            contentId: contentId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// @desc    Get liked content for the authenticated user
// @route   GET /api/users/likes
// @access  Private
const getLikedContents = asyncHandler(async (req, res) => {
    const userId = req.user.id; // Get userId from authenticated user

    // Validate userId format (should always be valid from protect middleware)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
    }

    try {
        // Find user and populate likes
        const user = await userData.findById(userId).populate({
            path: 'likes',
            select: 'title category description thumbnail video shortPreview previewUrl isApproved comments', // Include relevant fields
            match: { isApproved: true }, // Optional: Only return approved content
            populate: {
                path: 'comments.user',
                select: 'name profileImage', // Populate comment user details
            },
        });

        // Check if user exists
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            likedContents: user.likes || [], // Return empty array if no likes
        });
    } catch (error) {
        console.error('Get liked contents error:', JSON.stringify(error, null, 2));
        res.status(500).json({ error: 'Server error', details: error.message });
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
const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await userData.findOne({ email });

    if (!user) {

      return res.status(200).json({
        message:
          "If your email is registered with us, you will receive a password reset link shortly.",
      });
    }

    const token = await Token.findOne({ userId: user._id });
    if (token) {
      await token.deleteOne();
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await new Token({
      userId: user._id,
      token: hashedToken,
      createdAt: Date.now(),
    }).save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const mailOptions = {
      from: `"PlaymoodTV 📺" <${process.env.EMAIL_USERNAME}>`,
      to: email,
      subject: "Password Reset",
      html: `
        <p>You are receiving this email because you (or someone else) has requested the reset of the password for your account.</p>
        <p>Please click on the following link, or paste this into your browser to complete the process:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message:
        "If your email is registered with us, you will receive a password reset link shortly.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resetPassword = asyncHandler(async (req, res) => {
    try {
        const { password } = req.body;
        const { token } = req.params;

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const tokenDoc = await Token.findOne({ token: hashedToken });

        if (!tokenDoc) {
            return res.status(400).json({ message: "Invalid or expired token." });
        }

        // Check if the token has expired (15 minutes)
        const fifteenMinutes = 15 * 60 * 1000;
        if (Date.now() - tokenDoc.createdAt > fifteenMinutes) {
            await tokenDoc.deleteOne();
            return res.status(400).json({ message: "Token has expired. Please request a new one." });
        }

        const user = await userData.findById(tokenDoc.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);

        user.password = hashedPassword;
        await user.save();

        await tokenDoc.deleteOne();

        res.status(200).json({ message: "Password has been reset successfully." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

const changePassword = asyncHandler(async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Both current and new passwords are required." });
        }

        const user = await userData.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const isMatch = await bcryptjs.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect current password." });
        }

        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(newPassword, salt);

        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: "Password changed successfully." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
const googleAuthCallback = asyncHandler(async (req, res) => {

    if (req.user) {
        req.user.isEmailVerified = true;
        await req.user.save();
    }

    const token = generateToken(req.user._id, req.user.role);
    // Instead of responding with JSON, redirect to the frontend with the token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
});
// @desc Get creator application status
// @route GET /api/user/creator-application-status
// @access Private
const getCreatorApplicationStatus = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const user = await userData.findById(userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ creatorApplicationStatus: user.creatorApplicationStatus });
});
 
 module.exports = {
    getUser,
    getCreatorApplicationStatus,
    forgetPassword,
    resetPassword,
    registerUser,
    verifyEmail,
    resendVerificationCode,
    getCreators,
    createUser,
    loginUser,
    getUserprofile,
    updateUser,
    deleteUser,
    likeContent,
    unlikeContent,
    getLikedContents,
    saveContentToHistory,
    getUserHistory,
    markPrivacyPolicyAsRead,
    googleAuthCallback,
    changePassword
 }
