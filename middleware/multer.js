const multer = require('multer');
const path = require('path');

// Set the destination directory for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'path/to/your/upload/directory');
  },
  filename: function (req, file, cb) {
    // You can customize the filename if needed
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});

// Multer config
module.exports = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    let ext = path.extname(file.originalname);
    if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png" && ext !== ".mp4") {
      cb(new Error("File type is not supported"), false);
      return;
    }
    cb(null, true);
  },
});
