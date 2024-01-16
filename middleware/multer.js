// multer config
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Set the destination folder for file uploads
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Rename file with timestamp
  },
});

const fileFilter = (req, file, cb) => {
  const allowedFileTypes = ['.jpg', '.jpeg', '.png', '.mp4'];

  const extname = path.extname(file.originalname).toLowerCase();
  if (!allowedFileTypes.includes(extname)) {
    cb(new Error('File type is not supported'), false);
    return;
  }

  cb(null, true);
};

module.exports = multer({
  storage: storage,
  fileFilter: fileFilter,
}).fields([
  { name: 'video', maxCount: 1 }, // Field for video file
  { name: 'image', maxCount: 1 }, // Field for image file
]);




