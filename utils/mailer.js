const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: '217.116.0.228',
    port: 25,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
});

module.exports = transporter;