const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const userData = require('../models/userModel');
const nodemailer = require('nodemailer');

const protect = asyncHandler(async (req, res, next) => {
    let token;
       
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try{
            // get token from header
            token = req.headers.authorization.split(' ')[1];

            // verify token 
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // get user from the token 
            req.user = await userData.findById(decoded.id).select('-password');

            next();
        }catch (error) {
            console.log(error);
            res.status(401);
            throw new Error("you are not authorized to access this resources")
        }
    }
 
    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});
// nodemailer configs 
// const verifyEmail = asyncHandler(async (email, link) => {
//     try {
//         // let transporter = nodemailer.createTransport({
//         //     service: "Gmail",
//         //     auth: {
//         //         user: process.env.USER,
//         //         pass: process.env.PASS
//         //     }
//         // });

//         let transporter = nodemailer.createTransport({
//             host: "smtp.gmail.com",
//             port: 465,
//             secure: true,
//             auth: {
//               type: "OAuth2",
//               user: process.env.USER,
//               clientId: process.env.clientId,
//               clientSecret: process.env.clientSecret,
//               refreshToken: "1/XXxXxsss-xxxXXXXXxXxx0XXXxxXXx0x00xxx",
//               accessToken: "ya29.Xx_XX0xxxxx-xX0X0XxXXxXxXXXxX0x",
//               expires: 1484314697598,
//             },
//         });
          
//         // send email
//         let info = await transporter.sendMail({
//             from: process.env.USER,
//             to: email,
//             subject: "Account Verification",
//             text: "Welcome",
//             html: `
//                 <div>
//                     <a href=${link}> Click Here to Activate your email
//                 </div>
//             `
//         })
//         console.log("mail successfully sent!")
//         res.status(201).json("Mail successfully sent!");
//     } catch (error) {
//         console.log(error, "mail failed to send")
//         throw new Error('Mail failed to sent!');
//     }
// })

module.exports = {
    protect,
};

