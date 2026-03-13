const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const jwt = require('jsonwebtoken');
const { initWebSocket } = require('../websocket');
const sinon = require('sinon');
const uploadQueue = require('../config/queue');

describe('New Features: Only on Playmood and Soon on Playmood', function() {
    this.timeout(30000);
    let app, server, mongoServer, runningServer, token, adminToken, userId;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        const serverModule = require('../server');
        app = serverModule.app;
        server = serverModule.server;

        await new Promise(resolve => {
            runningServer = server.listen(0, resolve);
        });
        initWebSocket(runningServer);

        const user = await User.create({
            name: 'Creator User',
            email: 'creator@example.com',
            password: 'password',
            role: 'creator'
        });
        userId = user._id;
        token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test', { expiresIn: '1h' });

        const adminUser = await User.create({
            name: 'Admin User',
            email: 'admin@example.com',
            password: 'password',
            role: 'admin'
        });
        adminToken = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET || 'test', { expiresIn: '1h' });

        sinon.stub(uploadQueue, 'add').resolves();
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
        await new Promise(resolve => runningServer.close(resolve));
        sinon.restore();
    });

    describe('POST /api/content', () => {
        it('should create content with isOnlyOnPlaymood and scheduledReleaseDate', async () => {
            const releaseDate = new Date();
            releaseDate.setDate(releaseDate.getDate() + 7);

            const res = await request(app)
                .post('/api/content')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    title: 'Exclusive Soon Content',
                    category: 'Entertainment',
                    description: 'Description',
                    credit: 'Creator',
                    previewStart: 0,
                    previewEnd: 10,
                    video: { url: 'https://test.com/video.mp4', public_id: 'vid1' },
                    isOnlyOnPlaymood: true,
                    scheduledReleaseDate: releaseDate.toISOString()
                });

            expect(res.status).to.equal(202);
            const content = await Content.findOne({ title: 'Exclusive Soon Content' });
            expect(content.isOnlyOnPlaymood).to.be.true;
            expect(content.scheduledReleaseDate.getTime()).to.equal(releaseDate.getTime());
        });
    });

    describe('GET /api/content/only-on-playmood', () => {
        it('should return only exclusive content', async () => {
            await Content.create({
                user: userId,
                title: 'Only on Playmood Video',
                category: 'Music',
                description: 'Desc',
                credit: 'Credit',
                video: 'https://test.com/v1.mp4',
                isOnlyOnPlaymood: true,
                isApproved: true
            });

            await Content.create({
                user: userId,
                title: 'Regular Video',
                category: 'Music',
                description: 'Desc',
                credit: 'Credit',
                video: 'https://test.com/v2.mp4',
                isOnlyOnPlaymood: false,
                isApproved: true
            });

            const res = await request(app).get('/api/content/only-on-playmood');
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
            expect(res.body.length).to.equal(1);
            expect(res.body[0].title).to.equal('Only on Playmood Video');
        });
    });

    describe('GET /api/content/soon', () => {
        it('should return only content with future scheduledReleaseDate', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 5);

            await Content.create({
                user: userId,
                title: 'Soon Video',
                category: 'Music',
                description: 'Desc',
                credit: 'Credit',
                video: 'https://test.com/v3.mp4',
                scheduledReleaseDate: futureDate,
                isApproved: true
            });

            const res = await request(app).get('/api/content/soon');
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
            expect(res.body.some(v => v.title === 'Soon Video')).to.be.true;
        });
    });

    describe('GET /api/content/:id (Playback Restriction)', () => {
        it('should block playback and return 403 with metadata for unreleased content', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 5);

            const content = await Content.create({
                user: userId,
                title: 'Locked Video',
                category: 'Music',
                description: 'Lock Desc',
                credit: 'Credit',
                video: 'https://test.com/v4.mp4',
                thumbnail: 'https://test.com/thumb.jpg',
                scheduledReleaseDate: futureDate,
                isApproved: true
            });

            const res = await request(app).get(`/api/content/${content._id}`);
            expect(res.status).to.equal(403);
            expect(res.body.error).to.equal('This content is scheduled for a future release.');
            expect(res.body.isSoon).to.be.true;
            expect(res.body.title).to.equal('Locked Video');
            expect(res.body.thumbnail).to.equal('https://test.com/thumb.jpg');
            expect(res.body).to.not.have.property('video');
        });

        it('should allow playback for admins even if unreleased', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 5);

            const content = await Content.create({
                user: userId,
                title: 'Admin Viewable Video',
                category: 'Music',
                description: 'Lock Desc',
                credit: 'Credit',
                video: 'https://test.com/v5.mp4',
                scheduledReleaseDate: futureDate,
                isApproved: true
            });

            const res = await request(app)
                .get(`/api/content/${content._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).to.equal(200);
            expect(res.body.video).to.exist;
        });
    });
});
