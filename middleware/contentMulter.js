const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage({});

const fileFilter = (req, file, cb) => {
    const allowedImageExtensions = ['.jpg', '.jpeg', '.png'];
    const allowedVideoExtensions = ['.mp4'];
    const ext = path.extname(file.originalname);

    if (allowedImageExtensions.includes(ext)) {
        // File is an image
        cb(null, true);
    } else if (allowedVideoExtensions.includes(ext)) {
        // File is a video
        cb(null, true);
    } else {
        // File type is not supported
        cb(new Error('File type is not supported'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter
});
 
module.exports = {
    upload: upload,
    // array: (name, maxCount) => upload.array(name, maxCount)
    single: (name) => upload.single(name)
};
