
const asyncHandler = require ('express-async-handler');
const userData = require('../models/userModel');
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");               
const cloudinary = require('../config/cloudinary');


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
        } else {
            console.log('User creation failed');
            res.status(400);
            throw new Error('Invalid user data');
        }

        console.log('User registration completed'); // Log exit     point

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
    console.log('Before image deletion - Public ID:', publicId);
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
        const user = await userData.findById(userId);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Check if a file is present in the request
        if (req.file) {
            // Update the user's profile image in Cloudinary
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

        // Update other user data in MongoDB (name, email, etc.)
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;

        // Save the updated user in MongoDB
        const updatedUser = await user.save();

        res.status(200).json({
            message: 'User updated successfully',
            user: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                profileImage: updatedUser.profileImage,
                cloudinary_id: updatedUser.cloudinary_id,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});


// @desc Admin create user
// @route post /api/users/create
// @access Public
  

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
    console.log(email)

    // check for user email
    const user = await userData.findOne({email});


    if(user && (await bcryptjs.compare(password, user.password))) {
  console.log('User found during login:', user); // Add this log statement
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
             role: user.role,
            token: generateToken(user._id, user.role)
        });
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
 } )


 module.exports = {
    getUser, 
    registerUser,
    createUser,
    loginUser,
    getUserprofile,
    updateUser,
    deleteUser,
 }
