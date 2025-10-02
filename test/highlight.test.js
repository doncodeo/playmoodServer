const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const Highlight = require('../models/highlightModel');
const assert = require('assert');

describe('Highlight API', function() {
    this.timeout(10000);

    let app;
    let mongoServer;
    let creatorToken, adminToken, otherUserToken;
    let creatorId;
    let content, highlight;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        process.env.MONGO_URI = mongoUri;

        const serverModule = require('../server');
        app = serverModule.app;

        await mongoose.connect(mongoUri);

        const creatorUser = await User.create({ name: 'Creator', email: 'creator@test.com', password: 'password', role: 'creator' });
        creatorId = creatorUser._id;
        creatorToken = jwt.sign({ id: creatorId, role: 'creator' }, process.env.JWT_SECRET);

        const adminUser = await User.create({ name: 'Admin', email: 'admin@test.com', password: 'password', role: 'admin' });
        adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET);

        const otherUser = await User.create({ name: 'Other', email: 'other@test.com', password: 'password', role: 'creator' });
        otherUserToken = jwt.sign({ id: otherUser._id, role: 'creator' }, process.env.JWT_SECRET);
    });

    after(async () => {
        await User.deleteMany({});
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        content = await Content.create({
            user: creatorId,
            title: 'Test Content',
            category: 'Testing',
            description: 'A video for testing highlights.',
            credit: 'Test Creator',
            video: 'http://example.com/video.mp4',
            cloudinary_video_id: 'video123',
            isApproved: true,
        });

        highlight = await Highlight.create({
            user: creatorId,
            content: content._id,
            startTime: 10,
            endTime: 45,
        });

        content.highlight = highlight._id;
        await content.save();
    });

    afterEach(async () => {
        await Content.deleteMany({});
        await Highlight.deleteMany({});
    });

    describe('DELETE /api/highlights/:id', () => {
        it('should allow the creator to delete their own highlight', (done) => {
            request(app)
                .delete(`/api/highlights/${highlight._id}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .expect(200)
                .end(async (err, res) => {
                    if (err) return done(err);
                    assert.strictEqual(res.body.message, 'Highlight deleted successfully');

                    const deletedHighlight = await Highlight.findById(highlight._id);
                    assert.strictEqual(deletedHighlight, null);

                    const updatedContent = await Content.findById(content._id);
                    assert.strictEqual(updatedContent.highlight, null);

                    done();
                });
        });

        it('should allow an admin to delete any highlight', (done) => {
            request(app)
                .delete(`/api/highlights/${highlight._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200)
                .end(async (err, res) => {
                    if (err) return done(err);
                    const deletedHighlight = await Highlight.findById(highlight._id);
                    assert.strictEqual(deletedHighlight, null);
                    done();
                });
        });

        it('should not allow another user to delete the highlight', (done) => {
            request(app)
                .delete(`/api/highlights/${highlight._id}`)
                .set('Authorization', `Bearer ${otherUserToken}`)
                .expect(403)
                .end(async (err, res) => {
                    if (err) return done(err);
                    assert.strictEqual(res.body.message, 'User not authorized to delete this highlight');

                    const foundHighlight = await Highlight.findById(highlight._id);
                    assert.notStrictEqual(foundHighlight, null);
                    done();
                });
        });

        it('should return 404 if the highlight does not exist', (done) => {
            const nonExistentId = new mongoose.Types.ObjectId();
            request(app)
                .delete(`/api/highlights/${nonExistentId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404)
                .end((err, res) => {
                    if (err) return done(err);
                    assert.strictEqual(res.body.message, 'Highlight not found');
                    done();
                });
        });

        it('should return 401 if the user is not authenticated', (done) => {
            request(app)
                .delete(`/api/highlights/${highlight._id}`)
                .expect(401)
                .end(done);
        });
    });
});