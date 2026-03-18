const chai = require('chai');
const request = require('supertest');
const { app, server } = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Profile = require('../models/userModel');
const Content = require('../models/contentModel');
const Highlight = require('../models/highlightModel');
const sinon = require('sinon');
const storageService = require('../services/storageService');
const uploadQueue = require('../config/queue');

const expect = chai.expect;

let mongoServer;
let creator, admin, user;
let creatorToken, adminToken, userToken;
let content;
let runningServer;

// Helper function to generate a JWT token
const generateToken = async (id, role) => {
    const res = await request(app)
        .post('/api/v1/users/generate-token')
        .send({ id, role });
    return res.body.token;
};

describe('Standalone Highlight API', () => {
    let checkFileExistsStub;
    let queueAddStub;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Temporary endpoint for token generation
        app.post('/api/v1/users/generate-token', (req, res) => {
            const { id, role } = req.body;
            const jwt = require('jsonwebtoken');
            const token = jwt.sign({ id, role }, process.env.JWT_SECRET || 'test', { expiresIn: '1h' });
            res.json({ token });
        });

        creator = await Profile.create({ name: 'Creator', email: 'creator2@test.com', password: 'password', role: 'creator' });
        admin = await Profile.create({ name: 'Admin', email: 'admin2@test.com', password: 'password', role: 'admin' });
        user = await Profile.create({ name: 'User', email: 'user2@test.com', password: 'password', role: 'user' });

        creatorToken = await generateToken(creator.id, creator.role);
        adminToken = await generateToken(admin.id, admin.role);
        userToken = await generateToken(user.id, user.role);

        runningServer = server;
    });

    beforeEach(() => {
        checkFileExistsStub = sinon.stub(storageService, 'checkFileExists').resolves(true);
        queueAddStub = sinon.stub(uploadQueue, 'add').resolves({ id: 'job-id' });
    });

    afterEach(() => {
        sinon.restore();
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
        if (runningServer) {
            await new Promise(resolve => runningServer.close(resolve));
        }
    });

    describe('POST /api/highlights (Standalone)', () => {
        it('should create a standalone highlight with videoKey', async () => {
            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    title: 'Standalone Highlight',
                    videoKey: 'raw/user123/video.mp4'
                });

            expect(res.status).to.equal(201);
            expect(res.body.message).to.contain('being processed');

            const highlight = await Highlight.findById(res.body.highlightId);
            expect(highlight).to.exist;
            expect(highlight.title).to.equal('Standalone Highlight');
            expect(highlight.videoKey).to.equal('raw/user123/video.mp4');
            expect(highlight.status).to.equal('processing');
            expect(highlight.content).to.be.undefined;

            expect(queueAddStub.calledOnce).to.be.true;
            expect(queueAddStub.firstCall.args[0]).to.equal('process-highlight');
        });

        it('should return 400 if title is missing for standalone', async () => {
            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    videoKey: 'raw/user123/video.mp4'
                });

            expect(res.status).to.equal(400);
            expect(res.body.error).to.contain('Title is required');
        });

        it('should return 400 if videoKey does not exist in R2', async () => {
            checkFileExistsStub.withArgs('non-existent.mp4').resolves(false);

            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    title: 'Fake Video',
                    videoKey: 'non-existent.mp4'
                });

            expect(res.status).to.equal(400);
            expect(res.body.error).to.contain('does not exist in R2');
        });

        it('should handle custom thumbnailKey', async () => {
            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({
                    title: 'Highlight with Thumb',
                    videoKey: 'raw/user123/video.mp4',
                    thumbnailKey: 'raw/user123/thumb.jpg'
                });

            expect(res.status).to.equal(201);
            const highlight = await Highlight.findById(res.body.highlightId);
            expect(highlight.thumbnailKey).to.equal('raw/user123/thumb.jpg');
        });
    });

    describe('GET /api/highlights (Standalone filters)', () => {
        it('should retrieve approved standalone highlights in feeds', async () => {
            // Create an approved standalone highlight
            await Highlight.create({
                user: creator.id,
                title: 'Approved Standalone',
                videoKey: 'processed/h1.mp4',
                highlightUrl: 'https://cdn.com/h1.mp4',
                status: 'completed',
                isApproved: true
            });

            // Create an unapproved standalone highlight
            await Highlight.create({
                user: creator.id,
                title: 'Unapproved Standalone',
                videoKey: 'processed/h2.mp4',
                highlightUrl: 'https://cdn.com/h2.mp4',
                status: 'completed',
                isApproved: false
            });

            const res = await request(app).get('/api/highlights/all');
            expect(res.status).to.equal(200);

            const titles = res.body.map(h => h.title);
            expect(titles).to.include('Approved Standalone');
            expect(titles).to.not.include('Unapproved Standalone');
        });
    });
});
