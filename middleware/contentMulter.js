const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage({});

const fileFilter = (req, file, cb) => {
    const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const allowedVideoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const allowedAudioExtensions = ['.mp3', '.wav', '.ogg', '.m4a']; // Added for audio support
    const ext = path.extname(file.originalname).toLowerCase(); // Convert to lowercase

    if (
        allowedImageExtensions.includes(ext) ||
        allowedVideoExtensions.includes(ext) ||
        allowedAudioExtensions.includes(ext)
    ) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error('File type is not supported'), false); // Reject the file
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // Optional: Set max file size to 100MB
    },
});

module.exports = {
    upload: upload,
    single: (name) => upload.single(name),
};


// const multer = require('multer');
// const path = require('path');

// const storage = multer.memoryStorage({});

// const fileFilter = (req, file, cb) => {
//     const allowedImageExtensions = ['.jpg', '.jpeg', '.png'];
//     const allowedVideoExtensions = ['.mp4'];
//     const ext = path.extname(file.originalname);

//     if (allowedImageExtensions.includes(ext)) {
//         // File is an image
//         cb(null, true);
//     } else if (allowedVideoExtensions.includes(ext)) {
//         // File is a video
//         cb(null, true);
//     } else {
//         // File type is not supported
//         cb(new Error('File type is not supported'), false);
//     }
// };

// const upload = multer({
//     storage: storage,
//     fileFilter: fileFilter
// });
 
// module.exports = {
//     upload: upload,
//     // array: (name, maxCount) => upload.array(name, maxCount)
//     single: (name) => upload.single(name)
// };
