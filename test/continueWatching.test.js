const request = require('supertest');
const mongoose = require('mongoose');
const { expect } = require('chai');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

describe('Continue Watching Feature', function() {
    this.timeout(60000);

    let app, server, mongoServer;
    let token, userId, content1, content2;
    let userSchema, contentSchema;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        process.env.MONGO_URI = mongoUri;
        process.env.JWT_SECRET = 'test-secret';

        // Manually connect to the in-memory database
        await mongoose.connect(mongoUri);

        // Set up the app after env vars are set
        const serverModule = require('../server');
        app = serverModule.app;
        server = serverModule.server;

        userSchema = require('../models/userModel');
        contentSchema = require('../models/contentModel');

        const user = await userSchema.create({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
            role: 'user'
        });
        userId = user._id;
        token = jwt.sign({ id: userId, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        content1 = await contentSchema.create({
            user: userId,
            title: 'Video 1',
            category: 'Category 1',
            description: 'Description 1',
            credit: 'Credit 1',
            video: 'https://example.com/video1.mp4',
            thumbnail: 'https://example.com/thumb1.jpg',
            duration: 100,
            isApproved: true,
            shortPreview: { start: 0, end: 10 },
            status: 'completed'
        });

        // Ensure different createdAt by a small delay
        await new Promise(resolve => setTimeout(resolve, 10));

        content2 = await contentSchema.create({
            user: userId,
            title: 'Video 2',
            category: 'Category 2',
            description: 'Description 2',
            credit: 'Credit 2',
            video: 'https://example.com/video2.mp4',
            thumbnail: 'https://example.com/thumb2.jpg',
            duration: 200,
            isApproved: true,
            shortPreview: { start: 0, end: 10 },
            status: 'completed'
        });
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
    });

    it('should save video progress', async () => {
        const res = await request(app)
            .post(`/api/content/progress/${content1._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ progress: 50 });

        expect(res.status).to.equal(200);
        expect(res.body.progress).to.equal(50);

        const user = await userSchema.findById(userId);
        expect(user.videoProgress).to.have.lengthOf(1);
        expect(user.videoProgress[0].progress).to.equal(50);
    });

    it('should show up in continue watching list with lastWatchedAt', async () => {
        const res = await request(app)
            .get('/api/content/continue-watching')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.continueWatching).to.have.lengthOf(1);
        expect(res.body.continueWatching[0]._id.toString()).to.equal(content1._id.toString());
        expect(res.body.continueWatching[0].progress).to.equal(50);
        expect(res.body.continueWatching[0]).to.have.property('lastWatchedAt');
    });

    it('should sort by last watched descending', async () => {
        // Current state: content1 is at progress 50

        // 1. Watch content2 (most recent now)
        await new Promise(resolve => setTimeout(resolve, 10));
        await request(app)
            .post(`/api/content/progress/${content2._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ progress: 10 });

        let res = await request(app)
            .get('/api/content/continue-watching')
            .set('Authorization', `Bearer ${token}`);

        expect(res.body.continueWatching[0]._id.toString()).to.equal(content2._id.toString());

        // 2. Watch content1 again to make it "more recently watched"
        await new Promise(resolve => setTimeout(resolve, 100));
        await request(app)
            .post(`/api/content/progress/${content1._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ progress: 60 });

        res = await request(app)
            .get('/api/content/continue-watching')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.continueWatching).to.have.lengthOf(2);

        // Recently watched video (content1) should be first
        expect(res.body.continueWatching[0]._id.toString()).to.equal(content1._id.toString(), 'Recently watched video should be first');
    });

    it('should remove finished videos (>95%) from continue watching list', async () => {
        // Watch content2 to 96% (duration is 200, so 192)
        await request(app)
            .post(`/api/content/progress/${content2._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ progress: 192 });

        const res = await request(app)
            .get('/api/content/continue-watching')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).to.equal(200);
        const ids = res.body.continueWatching.map(v => v._id.toString());
        expect(ids).to.not.include(content2._id.toString(), 'Finished video (>95%) should be removed');
    });

    it('should limit the list to 20 items', async () => {
        // Create 25 more content items and watch them
        const extraContents = [];
        for (let i = 0; i < 25; i++) {
            const c = await contentSchema.create({
                user: userId,
                title: `Extra Video ${i}`,
                category: 'Category',
                description: 'Description',
                credit: 'Credit',
                video: `https://example.com/extra${i}.mp4`,
                thumbnail: 'https://example.com/thumb.jpg',
                duration: 100,
                isApproved: true,
                shortPreview: { start: 0, end: 10 },
                status: 'completed'
            });
            extraContents.push(c);
            await request(app)
                .post(`/api/content/progress/${c._id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ progress: 5 });
        }

        const res = await request(app)
            .get('/api/content/continue-watching')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.continueWatching).to.have.lengthOf(20, 'Should be limited to 20 items');
        // The last one we watched (Extra Video 24) should be first
        expect(res.body.continueWatching[0].title).to.equal('Extra Video 24');
    });
});
