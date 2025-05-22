const multer = require('multer');
const path = require('path');

const upload = multer({
    storage: multer.diskStorage({}),
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.mp4', '.mov', '.avi', '.jpg', '.jpeg', '.png'];
        if (!allowedExts.includes(ext)) {
            return cb(new Error('Only .mp4, .mov, .avi, .jpg, .jpeg, and .png files are allowed'));
        }
        cb(null, true);
    }
});

module.exports = upload;



// const multer = require('multer');
// const path = require('path');

// // Multer config
// const upload = multer({
//     storage: multer.diskStorage({}),
//     fileFilter: (req, file, cb) => {
//         const ext = path.extname(file.originalname);
//         if (ext !== '.mp4' && ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
//             return cb(new Error('Only .mp4, .jpg, .jpeg, and .png files are allowed'));
//         }
//         cb(null, true);
//     }
// });

// module.exports = upload;



