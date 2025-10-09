const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const { expect } = chai;
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app, server } = require('../server');
const User = require('../models/userModel');
const cloudinary = require('../config/cloudinary');
const jwt = require('jsonwebtoken');

chai.use(chaiHttp);

describe('Channel Controller - Integration Tests', () => {
    let mongoServer;
    let creator;
    let token;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        creator = new User({
            name: 'Test Creator',
            email: 'creator.channel.test@example.com',
            password: 'password123',
            role: 'creator',
            bannerImage: 'old_url',
            bannerImageId: 'old_id'
        });
        await creator.save();

        token = jwt.sign({ id: creator._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
        server.close(); // Close the server to prevent hanging
    });

    beforeEach(() => {
        // Stub the cloudinary uploader
        sinon.stub(cloudinary.uploader, 'destroy').resolves();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('PUT /api/channel/:userId/banner', () => {
        it('should update the channel banner image and return success', async () => {
            const newImageData = {
                url: 'http://new.banner.url/image.jpg',
                public_id: 'new_banner_id'
            };

            const res = await chai.request(app)
                .put(`/api/channel/${creator._id}/banner`)
                .set('Authorization', `Bearer ${token}`)
                .send(newImageData);

            expect(res).to.have.status(200);
            expect(res.body).to.have.property('message', 'Channel banner image updated successfully');
            expect(res.body).to.have.property('bannerImage', newImageData.url);

            // Verify the database was updated
            const updatedUser = await User.findById(creator._id);
            expect(updatedUser.bannerImage).to.equal(newImageData.url);
            expect(updatedUser.bannerImageId).to.equal(newImageData.public_id);

            // Verify the old image was deleted
            expect(cloudinary.uploader.destroy.calledOnceWith('old_id')).to.be.true;
        });

        it('should return 400 if image data is missing', async () => {
            const res = await chai.request(app)
                .put(`/api/channel/${creator._id}/banner`)
                .set('Authorization', `Bearer ${token}`)
                .send({});

            expect(res).to.have.status(400);
            expect(res.body).to.have.property('error', 'Image URL and public_id are required');
        });

        it('should return 403 if another user tries to update the banner', async () => {
            const otherUser = new User({ name: 'Other User', email: 'other.user@example.com', password: 'password' });
            await otherUser.save();
            const otherToken = jwt.sign({ id: otherUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

            const newImageData = {
                url: 'http://new.banner.url/image.jpg',
                public_id: 'new_banner_id'
            };

            const res = await chai.request(app)
                .put(`/api/channel/${creator._id}/banner`)
                .set('Authorization', `Bearer ${otherToken}`)
                .send(newImageData);

            expect(res).to.have.status(403);
            expect(res.body).to.have.property('error', 'You are not authorized to update this channel');
        });
    });
});