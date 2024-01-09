
const asyncHandler = require ('express-async-handler');
const userData = require('../models/userModel');
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");

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
        const {name, email, password, profileImage, role} = req.body
        
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
        console.log(hashedPassword)

        // create user
        const user = await userData.create({
            name,
            email,
            password:hashedPassword,
            profileImage,
            role
        })

        if (user) {
            console.log('User created:', user.email);
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id)
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
<<<<<<< HEAD
    const {_id, name, email, profileImage, role} = await userData.findById(req.user.id)
=======
    const {_id, name, email, role, profileImage} = await userData.findById(req.user.id)
>>>>>>> 1da42c55af776c584d5c823b673cb5fd59ffcca5
      
    res.status(200).json({
     id:_id,
     name,
     email,
     role,
     profileImage
    })
 } )


// @desc Update Top
// @route UPDATE /api/top/:id
// @access Private

const updateUser = asyncHandler(async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Check if the top document with the given ID exists
        const user = await userData.findById(userId);

        if (!user) {
            res.status(400).json({ error: 'Document does not exit!' });
            return;
        }

        // Update the fields you want to change
        if (req.body.name) {
            user.name = req.body.name;
        }
        if (req.body.email) {
            user.email = req.body.email;
        }
        if (req.body.profileImage) {
            user.profileImage = req.body.profileImage;
        }
        
        // Save the updated document
        await user.save();

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
})

// @desc Delete Top 
// @route DELETE /api/top/:id
// @access Private

const deleteUser = asyncHandler(async (req, res) => {
    try {
        const userId = req.params.id; 
        console.log(userId)
        const user = await userData.findById(userId);

        if (!user) {
            res.status(400).json({ error: 'Document not found!' });
            return;
        }

        // Delete the top document
        await user.remove()
        
        res.status(200).json({ id: req.params.id });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
})


 module.exports = {
    getUser, 
    registerUser,
    createUser,
    loginUser,
    getUserprofile,
    updateUser,
    deleteUser,
 }
