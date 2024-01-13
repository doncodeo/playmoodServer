
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

        const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
            folder: 'user-uploads',
        });

        const {name, email, password} = req.body
        
        if (!name || !email || !password) {
          
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
        // console.log(hashedPassword)

        // create user
        const user = await userData.create({
            name,
            email,
            password:hashedPassword,
            profileImage: cloudinaryResult.secure_url,
            cloudinary_id: cloudinaryResult.public_id,
        })

        if (user) {
            console.log('User created:', user.email);
            console.log(cloudinaryResult)
            res.status(201).json({user});
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
    console.log(user) 

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

      console.log(req.file.path)
  
      // Update the user's profile image in Cloudinary
      const updatedCloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
        folder: 'user-uploads',
        public_id: user._id, // Set public_id to a unique identifier like user._id
      });
  
      // If updating the profile image, delete the old image in Cloudinary
      if (user.cloudinary_id) {
        await cloudinary.uploader.destroy(user.cloudinary_id);
      }
  
      // Update user data in MongoDB
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.profileImage = updatedCloudinaryResult.secure_url;
      user.cloudinary_id = updatedCloudinaryResult.public_id;
  
      // Save the updated user in MongoDB
      const updatedUser = await user.save();
  
      res.status(200).json({
        message: 'User updated successfully',
        user: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          profileImage: updatedUser.profileImage,
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
