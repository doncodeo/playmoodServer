const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const userData = require('../models/userModel');
const nodemailer = require('nodemailer');


 
const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decoded.id).select('-password');

            next();
        } catch (error) {
            res.status(401);
            throw new Error('Not authorized, token failed');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(401);
        throw new Error('Not authorized as an admin');
    }
};

module.exports = { 
    protect, 
    admin 
};



// const protect = asyncHandler(async (req, res, next) => {
//     let token;
       
//     if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//         try{
//             // get token from header
//             token = req.headers.authorization.split(' ')[1];

//             // verify token 
//             // Verify token
//             const decoded = jwt.verify(token, process.env.JWT_SECRET);

//             // get user from the token 
//             req.user = await userData.findById(decoded.id).select('-password');

//             next();
//         }catch (error) {
//             console.log(error);
//             res.status(401);
//             throw new Error("you are not authorized to access this resources")
//         }
//     }
 
//     if (!token) {
//         res.status(401);
//         throw new Error('Not authorized, no token');
//     }
// });

// module.exports = {
//     protect,
// };

