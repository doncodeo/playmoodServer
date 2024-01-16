const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');

aws.config.update({
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  region: process.env.AWS_REGION,
});

const s3 = new aws.S3();

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'your-s3-bucket-name',
    key: function (req, file, cb) {
      cb(null, 'path/in/s3/' + Date.now() + '-' + file.originalname);
    },
  }),
  fileFilter: (req, file, cb) => {
    let ext = path.extname(file.originalname);
    if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png' && ext !== '.mp4') {
      cb(new Error('File type is not supported'), false);
      return;
    }
    cb(null, true);
  },
});

module.exports = upload;
