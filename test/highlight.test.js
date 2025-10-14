const chai = require('chai');
const request = require('supertest');
const { app, server } = require('../server');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Profile = require('../models/userModel');
const Content = require('../models/contentModel');
const Highlight = require('../models/highlightModel');

const expect = chai.expect;

let mongoServer;
let creator, admin, user;
let creatorToken, adminToken, userToken;
let content;
let runningServer;

// Helper function to generate a JWT token
const generateToken = async (id, role) => {
    const res = await request(app)
        .post('/api/v1/users/generate-token') // A temporary endpoint to generate token for testing
        .send({ id, role });
    return res.body.token;
};

describe('Highlight API', () => {
    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Temporary endpoint for token generation
        app.post('/api/v1/users/generate-token', (req, res) => {
            const { id, role } = req.body;
            const jwt = require('jsonwebtoken');
            const token = jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token });
        });

        // Create users and tokens
        creator = await Profile.create({ name: 'Creator', email: 'creator@test.com', password: 'password', role: 'creator', profileImage: 'https://example.com/profile.jpg' });
        admin = await Profile.create({ name: 'Admin', email: 'admin@test.com', password: 'password', role: 'admin' });
        user = await Profile.create({ name: 'User', email: 'user@test.com', password: 'password', role: 'user' });

        creatorToken = await generateToken(creator.id, creator.role);
        adminToken = await generateToken(admin.id, admin.role);
        userToken = await generateToken(user.id, user.role);

        // Create content
        content = await Content.create({
            user: creator.id,
            title: 'Test Content',
            category: 'testing',
            description: 'A test content for highlights.',
            video: 'test.mp4',
            credit: 'Test Creator',
        });

        runningServer = server;
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
        if (runningServer) {
            await new Promise(resolve => runningServer.close(resolve));
        }
    });

    afterEach(async () => {
        await Highlight.deleteMany({});
        await Content.findByIdAndUpdate(content.id, { highlights: [] });
    });

    describe('POST /api/highlights', () => {
        it('should create a highlight for the content creator', async () => {
            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ contentId: content.id, startTime: 0, endTime: 15 });

            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('startTime', 0);
            expect(res.body).to.have.property('endTime', 15);

            const updatedContent = await Content.findById(content.id);
            expect(updatedContent.highlights).to.have.lengthOf(1);
        });

        it('should allow an admin to create a highlight', async () => {
            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ contentId: content.id, startTime: 20, endTime: 35 });

            expect(res.status).to.equal(201);
            const updatedContent = await Content.findById(content.id);
            expect(updatedContent.highlights).to.have.lengthOf(1);
        });

        it('should prevent a regular user from creating a highlight', async () => {
            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ contentId: content.id, startTime: 0, endTime: 15 });

            expect(res.status).to.equal(403);
        });

        it('should prevent creating overlapping highlights', async () => {
            // Create initial highlight
            await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ contentId: content.id, startTime: 10, endTime: 25 });

            // Attempt to create an overlapping highlight
            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ contentId: content.id, startTime: 20, endTime: 30 });

            expect(res.status).to.equal(400);
            expect(res.body.error).to.equal('Highlight timeline overlaps with an existing highlight.');
        });

        it('should allow multiple non-overlapping highlights', async () => {
            await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ contentId: content.id, startTime: 0, endTime: 10 });

            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ contentId: content.id, startTime: 15, endTime: 25 });

            expect(res.status).to.equal(201);
            const updatedContent = await Content.findById(content.id);
            expect(updatedContent.highlights).to.have.lengthOf(2);
        });

        it('should create a highlight with a custom title', async () => {
            const customTitle = 'My Custom Highlight Title';
            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ contentId: content.id, startTime: 0, endTime: 15, title: customTitle });

            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('title', customTitle);
        });

        it('should create a highlight with the content title if no title is provided', async () => {
            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ contentId: content.id, startTime: 0, endTime: 15 });

            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('title', content.title);
        });
    });

    describe('DELETE /api/highlights/:id', () => {
        let highlight;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ contentId: content.id, startTime: 0, endTime: 15 });
            highlight = res.body;
        });

        it('should allow the creator to delete a highlight', async () => {
            const res = await request(app)
                .delete(`/api/highlights/${highlight._id}`)
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).to.equal(200);
            const updatedContent = await Content.findById(content.id);
            expect(updatedContent.highlights).to.have.lengthOf(0);
        });

        it('should allow an admin to delete a highlight', async () => {
            const res = await request(app)
                .delete(`/api/highlights/${highlight._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).to.equal(200);
            const updatedContent = await Content.findById(content.id);
            expect(updatedContent.highlights).to.have.lengthOf(0);
        });

        it('should prevent a regular user from deleting a highlight', async () => {
            const res = await request(app)
                .delete(`/api/highlights/${highlight._id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.status).to.equal(403);
        });
    });

    describe('GET /api/highlights', () => {
        let highlight;

        beforeEach(async () => {
            // Create approved content
            content = await Content.create({
                user: creator.id,
                title: 'Approved Content',
                category: 'testing',
                description: 'Approved content for highlight testing.',
                video: 'test.mp4',
                credit: 'Test Creator',
                isApproved: true,
            });

            // Create a highlight for the approved content
            const res = await request(app)
                .post('/api/highlights')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ contentId: content.id, startTime: 0, endTime: 15 });
            highlight = res.body;
        });

        it('should get highlights by creator with user info', async () => {
            const res = await request(app)
                .get(`/api/highlights/creator/${creator.id}`);

            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
            expect(res.body[0].user).to.have.property('name', creator.name);
            expect(res.body[0].user).to.have.property('profileImage');
        });

        it('should get recent highlights with user info', async () => {
            const res = await request(app)
                .get('/api/highlights/recent');

            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
            expect(res.body[0].user).to.have.property('name');
            expect(res.body[0].user).to.have.property('profileImage');
        });

        it('should get all highlights with user info', async () => {
            const res = await request(app)
                .get('/api/highlights/all');

            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
            expect(res.body[0].user).to.have.property('name');
            expect(res.body[0].user).to.have.property('profileImage');
        });
    });
});