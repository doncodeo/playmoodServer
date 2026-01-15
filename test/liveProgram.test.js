const chai = require('chai');
const chaiHttp = require('chai-http');
const { app, server } = require('../server');
const mongoose = require('mongoose');
const LiveProgram = require('../models/liveProgramModel');
const Content = require('../models/contentModel');
const User = require('../models/userModel');

chai.use(chaiHttp);
const expect = chai.expect;

describe('PlaymoodTV LIVE API', () => {
    let adminToken;
    let userToken;
    let testContent;
    let testProgram;

    before(async () => {
        // Clear the database before running tests
        await mongoose.connection.dropDatabase();

        // Create a test admin user
        const adminUser = new User({
            name: 'Test Admin',
            email: 'admin@test.com',
            password: 'password123',
            role: 'admin',
        });
        await adminUser.save();

        // Create a regular test user
        const regularUser = new User({
            name: 'Test User',
            email: 'user@test.com',
            password: 'password123',
            role: 'user',
        });
        await regularUser.save();

        // Create test content
        testContent = await Content.create({
            user: adminUser._id,
            title: 'Live Test Video',
            category: 'Testing',
            description: 'A video for live testing.',
            credit: 'Test Crew',
            video: 'https://res.cloudinary.com/test/video.mp4',
            duration: 3600, // 1 hour
        });

        // Log in as admin to get a token
        const adminLoginRes = await chai.request(app)
            .post('/api/users/login')
            .send({ email: 'admin@test.com', password: 'password123' });
        adminToken = adminLoginRes.body.token;

        // Log in as regular user to get a token
        const userLoginRes = await chai.request(app)
            .post('/api/users/login')
            .send({ email: 'user@test.com', password: 'password123' });
        userToken = userLoginRes.body.token;
    });

    after(async () => {
        await mongoose.connection.dropDatabase();
        server.close();
    });

    describe('Admin: Program Management', () => {
        it('should allow an admin to create a new live program', (done) => {
            const today = new Date();
            const startTime = new Date(today.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

            chai.request(app)
                .post('/api/live-programs')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    videoId: testContent._id.toString(),
                    date: startTime.toISOString().slice(0, 10),
                    startTime: startTime.toTimeString().slice(0, 5),
                })
                .end((err, res) => {
                    expect(res).to.have.status(201);
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.property('videoId', testContent._id.toString());
                    expect(res.body).to.have.property('status', 'scheduled');
                    testProgram = res.body; // Save for later tests
                    done();
                });
        });

        it('should allow an admin to update an existing live program', (done) => {
            const newStartTime = new Date(new Date(testProgram.date).getTime() + 3 * 60 * 60 * 1000); // 1 hour later
            chai.request(app)
                .put(`/api/live-programs/${testProgram._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    startTime: newStartTime.toTimeString().slice(0, 5),
                })
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.property('startTime', newStartTime.toTimeString().slice(0, 5));
                    done();
                });
        });

        it('should allow an admin to delete a live program', (done) => {
            chai.request(app)
                .delete(`/api/live-programs/${testProgram._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.have.property('message', 'Live program deleted successfully');
                    done();
                });
        });
    });

    describe('User: Viewing Experience', () => {
        it('should get today\'s programming with live and upcoming shows', async () => {
            // Create a program that is currently live
            const now = new Date();
            const liveStartTime = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago
            await LiveProgram.create({
                videoId: testContent._id,
                title: 'Currently Live Show',
                description: 'This show is on the air.',
                thumbnail: 'live_thumb.jpg',
                date: liveStartTime.toISOString().slice(0, 10),
                startTime: liveStartTime.toTimeString().slice(0, 5),
                endTime: new Date(liveStartTime.getTime() + 3600 * 1000).toTimeString().slice(0, 5),
                duration: 3600,
                status: 'live',
            });

            // The 'testProgram' created earlier is our upcoming program
            const res = await chai.request(app).get('/api/live-programs/today');

            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');

            // Check the live program
            expect(res.body).to.have.property('liveProgram');
            expect(res.body.liveProgram).to.be.an('object');
            expect(res.body.liveProgram).to.have.property('title', 'Currently Live Show');
            expect(res.body.liveProgram).to.have.property('currentPlaybackTime').that.is.a('number');
            expect(res.body.liveProgram.currentPlaybackTime).to.be.closeTo(900, 5); // Approx 15 mins (900s), with 5s tolerance

            // Check upcoming programs
            expect(res.body).to.have.property('upcomingPrograms').that.is.an('array');
            expect(res.body.upcomingPrograms).to.have.lengthOf(1);
            expect(res.body.upcomingPrograms[0]).to.have.property('_id', testProgram._id);
        });
    });
});
