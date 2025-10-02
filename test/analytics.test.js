const request = require('supertest');
const { app } = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const Analytics = require('../models/analyticsModel');
const jwt = require('jsonwebtoken');
const assert = require('assert');

describe('Analytics API', function() {
    this.timeout(30000);

    let adminToken, creatorToken;
    let adminId, creatorId;
    let mongoServer;
    let runningServer;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        const adminUser = await User.create({
            name: 'Admin User',
            email: 'admin.analytics@example.com',
            password: 'password',
            role: 'admin'
        });
        adminId = adminUser._id;
        adminToken = jwt.sign({ id: adminId, role: 'admin' }, process.env.JWT_SECRET);

        const creatorUser = await User.create({
            name: 'Creator User',
            email: 'creator.analytics@example.com',
            password: 'password',
            role: 'creator',
            country: 'USA'
        });
        creatorId = creatorUser._id;
        creatorToken = jwt.sign({ id: creatorId, role: 'creator' }, process.env.JWT_SECRET);

        // Create some content
        await Content.create({
            user: creatorId,
            title: 'Test Video 1',
            category: 'Testing',
            description: 'A test video',
            credit: 'Creator User',
            video: 'video_url',
            isApproved: true,
            views: 100,
            likes: [new mongoose.Types.ObjectId()],
            comments: [{ user: adminId, text: 'A comment' }]
        });

        await Content.create({
            user: creatorId,
            title: 'Test Video 2',
            category: 'Testing',
            description: 'Another test video',
            credit: 'Creator User',
            video: 'video_url_2',
            isApproved: false,
            rejectionReason: 'Poor quality'
        });

        runningServer = app.listen(0);
    });

    after(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
        await mongoServer.stop();
        if (runningServer) {
            await new Promise(resolve => runningServer.close(resolve));
        }
    });

    describe('Admin Analytics', () => {
        it('should get platform analytics', (done) => {
            request(app)
                .get('/api/analytics/admin/platform')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    assert.strictEqual(res.body.users.total, 2);
                    assert.strictEqual(res.body.content.total, 2);
                    assert.strictEqual(res.body.trendingVideos.length, 1);
                    assert.strictEqual(res.body.mostActiveCreators.length, 1);
                    done();
                });
        });

        it('should get user demographics', (done) => {
            request(app)
                .get('/api/analytics/admin/user-demographics')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    assert.strictEqual(res.body.length, 1);
                    assert.strictEqual(res.body[0].country, 'USA');
                    assert.strictEqual(res.body[0].count, 1);
                    done();
                });
        });

        it('should get moderation analytics', (done) => {
            request(app)
                .get('/api/analytics/admin/moderation')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    assert.strictEqual(res.body.rejectedContent.total, 1);
                    assert.strictEqual(res.body.commonRejectionReasons.length, 1);
                    assert.strictEqual(res.body.commonRejectionReasons[0].reason, 'Poor quality');
                    done();
                });
        });
    });

    describe('Creator Analytics', () => {
        it('should get creator dashboard analytics', (done) => {
            request(app)
                .get('/api/analytics/creator/dashboard')
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    assert.strictEqual(res.body.uploads.total, 2);
                    assert.strictEqual(res.body.uploads.status.active, 1);
                    assert.strictEqual(res.body.uploads.status.rejected, 1);
                    assert.strictEqual(res.body.performance.totalViews, 100);
                    assert.strictEqual(res.body.performance.totalLikes, 1);
                    assert.strictEqual(res.body.performance.totalComments, 1);
                    done();
                });
        });
    });
});