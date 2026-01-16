const cloudinary = require('cloudinary').v2;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
let apiKey = process.env.CLOUDINARY_API_KEY;
let apiSecret = process.env.CLOUDINARY_API_SECRET;

// Sanitize credentials: remove all single and double quotes from anywhere in the strings
if (apiKey) {
    apiKey = apiKey.replace(/['"]/g, '');
}
if (apiSecret) {
    apiSecret = apiSecret.replace(/['"]/g, '');
}

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    'Cloudinary environment variables are missing. Please provide CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
  );
}
          
cloudinary.config({ 
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret
});

console.log(`Cloudinary configured for cloud name: ${cloudName}`);

module.exports = cloudinary;