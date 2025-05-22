// const multer = require('multer');
// const path = require('path');
const multer = require('multer');
const path = require('path');

// Multer config
const upload = multer({
    storage: multer.diskStorage({}),
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase(); // Convert to lowercase
        const allowedExtensions = ['.mp4', '.jpg', '.jpeg', '.png'];
        
        if (!allowedExtensions.includes(ext)) {
            return cb(new Error(`Only ${allowedExtensions.join(', ')} files are allowed`));
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



