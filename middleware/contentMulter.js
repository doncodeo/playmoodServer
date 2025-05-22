const multer = require('multer');
const path = require('path');
const storage = multer.memoryStorage({});
const mime = require('mime-types');


const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg', // .jpg, .jpeg
        'image/png', // .png
        'image/gif', // .gif
        'image/bmp', // .bmp
        'image/webp', // .webp
        'video/mp4', // .mp4
        'video/mpeg', // .mpeg
        'video/quicktime', // .mov
        'video/x-msvideo', // .avi
        'video/x-matroska', // .mkv
        'video/webm', // .webm
        'audio/mpeg', // .mp3
        'audio/wav', // .wav
        'audio/ogg', // .ogg
        'audio/mp4', // .m4a
    ];

    const mimeType = mime.lookup(file.originalname) || file.mimetype;

    console.log('File details:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        detectedMime: mimeType,
    });

    if (allowedMimeTypes.includes(mimeType)) {
        console.log('File accepted:', mimeType);
        cb(null, true);
    } else {
        console.log('File rejected:', mimeType);
        cb(new Error(`Unsupported file type: ${mimeType}`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // Max 100MB
    },
});

module.exports = {
    upload: upload,
    single: (name) => upload.single(name),
    array: (name, maxCount) => upload.array(name, maxCount),
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
