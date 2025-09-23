const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary'); // This should have the v2 config

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    // Determine folder based on file type
    const isVideo = file.mimetype.startsWith('video');
    const folder = isVideo ? 'videos' : 'thumbnails';

    return {
      folder: folder,
      resource_type: 'auto', // Let Cloudinary auto-detect the resource type
      allowed_formats: ['mp4', 'mov', 'avi', 'jpg', 'jpeg', 'png'],
      public_id: file.originalname.split('.')[0] + '-' + Date.now(),
    };
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 3 * 1024 * 1024 * 1024, // 3 GB
  },
});

module.exports = upload;
