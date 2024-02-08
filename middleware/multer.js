// const multer = require('multer');
// const path = require('path');

// // multer config

// module.exports = multer({
//     storage: multer.diskStorage({}),
//     fileFilter: (req, file, cb) => {
//         let ext = path.extname(file.originalname);
//         if(ext !==".jpg" && ext !==".jpeg" && ext !==".png" && ext !==".mp4") {
//             cb(new Error ("File type is not supported"), false);
//             return;
//         }
//         cb(null, true)
//     }
// }) // Add this line


const multer = require('multer');
const path = require('path');

// Multer config
const upload = multer({
    storage: multer.diskStorage({}),
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        if (ext !== '.mp4' && ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
            return cb(new Error('Only .mp4, .jpg, .jpeg, and .png files are allowed'));
        }
        cb(null, true);
    }
});

module.exports = upload;



