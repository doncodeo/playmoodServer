const chai = require('chai');
const expect = chai.expect;
const { upload } = require('../middleware/multer');

describe('Multer Middleware HEIC support', () => {
    it('should accept image/heic mimetype', (done) => {
        const file = {
            originalname: 'test.heic',
            mimetype: 'image/heic'
        };
        const req = {};

        // Access the fileFilter directly from the upload object
        const fileFilter = upload.fileFilter;

        fileFilter(req, file, (err, accepted) => {
            expect(err).to.be.null;
            expect(accepted).to.be.true;
            done();
        });
    });

    it('should accept image/heif mimetype', (done) => {
        const file = {
            originalname: 'test.heif',
            mimetype: 'image/heif'
        };
        const req = {};
        const fileFilter = upload.fileFilter;

        fileFilter(req, file, (err, accepted) => {
            expect(err).to.be.null;
            expect(accepted).to.be.true;
            done();
        });
    });

    it('should reject unsupported mimetypes', (done) => {
        const file = {
            originalname: 'test.exe',
            mimetype: 'application/x-msdownload'
        };
        const req = {};
        const fileFilter = upload.fileFilter;

        fileFilter(req, file, (err, accepted) => {
            expect(err).to.be.an('error');
            expect(err.message).to.contain('Unsupported file type');
            expect(accepted).to.be.false;
            done();
        });
    });
});
