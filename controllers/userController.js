
const asyncHandler = require ('express-async-handler')

const userData = require('../models/userModel')



const getUser = asyncHandler(async (req, res) => {
      
    const users = await userData.find()

    res.status(200).json(users)
})



const postUser = asyncHandler(async (req, res) => {
    try {
        
        if (!req.body.name || !req.body.email || !req.body.password) {
          
            res.status(400).json({ error: 'some fields missing!' });
            return;
        }

        const top = await userData.create({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            role: req.body.role,
            profileImage: req.body.profileImage, 
            // favorites: req.body.favorites    ,
            // friends: req.body.friends,
            // watchlist: req.body.watchlist,
            // history: req.body.history,
            // subscription: req.body.subscription 

        });
 
        res.status(200).json(top);
    } catch (error) {
        console.error(error); // Log any errors to the console for debugging
        res.status(500).json({ error: 'Server error' });
    }
}); 

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
    postUser,
    updateUser,
    deleteUser,
 }