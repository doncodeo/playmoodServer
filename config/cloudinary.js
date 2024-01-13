const cloudinary = require('cloudinary').v2;
          
cloudinary.config({ 
  cloud_name: 'di97mcvbu', 
  api_key: '899855681539781', 
  api_secret: '7L9Z-848jU7of48Qibc5s4FNkJI' 
});

          
// cloudinary.config({ 
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
//   api_key: process.env.CLOUDINARY_API_KEY, 
//   api_secret: process.env.CLOUDINARY_API_SECRET 
// });

module.exports = cloudinary;