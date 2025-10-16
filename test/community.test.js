const request = require('supertest');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const CommunityPost = require('../models/communityPostModel');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { initWebSocket } = require('../websocket');
const WebSocket = require('ws');

describe('Community Post API', function () {
    this.timeout(60000);

    let app, server;
    let token;
    let userId;
    let mongoServer;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        process.env.MONGO_URI = mongoUri;
        await mongoose.connect(mongoUri);

        const serverModule = require('../server');
        app = serverModule.app;
        server = serverModule.server;

        await new Promise(resolve => {
            server.listen(0, () => {
                initWebSocket(server);
                resolve();
            });
        });

        const user = await User.create({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password',
            role: 'creator'
        });
        userId = user._id;

        token = jwt.sign({ id: userId, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });
    });

    after(async () => {
        await User.deleteMany({});
        await mongoose.disconnect();
        await mongoServer.stop();
        await new Promise(resolve => server.close(resolve));
    });

    describe('PUT /api/community/:postId/like', () => {
        let post;
        let wsClient;
        let messages = [];

        beforeEach(async () => {
            post = await CommunityPost.create({
                user: userId,
                content: 'A test post',
            });

            const port = server.address().port;
            wsClient = new WebSocket(`ws://localhost:${port}`);
            messages = [];
            wsClient.on('message', (message) => {
                messages.push(JSON.parse(message));
            });
            await new Promise(resolve => wsClient.on('open', resolve));
        });

        afterEach(async () => {
            await CommunityPost.deleteMany({});
            wsClient.close();
        });

        it('should like a community post and broadcast a websocket event', (done) => {
            request(app)
                .put(`/api/community/${post._id}/like`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    if (res.body.likes.length !== 1) {
                        return done(new Error('Like count should be 1'));
                    }
                    if (res.body.likes[0] !== userId.toString()) {
                        return done(new Error('User ID not added to likes'));
                    }

                    setTimeout(() => {
                        if (messages.length === 0) {
                            return done(new Error('No WebSocket message received'));
                        }
                        const wsMessage = messages[0];
                        if (wsMessage.event !== 'community_post_liked') {
                            return done(new Error('Incorrect WebSocket event'));
                        }
                        if (wsMessage.payload.postId !== post._id.toString()) {
                            return done(new Error('Incorrect post ID in WebSocket payload'));
                        }
                        if (wsMessage.payload.likes !== 1) {
                            return done(new Error('Incorrect like count in WebSocket payload'));
                        }
                        done();
                    }, 500);
                });
        });
    });

    describe('PUT /api/community/:postId/unlike', () => {
        let post;
        let wsClient;
        let messages = [];

        beforeEach(async () => {
            post = await CommunityPost.create({
                user: userId,
                content: 'A test post',
                likes: [userId],
            });

            const port = server.address().port;
            wsClient = new WebSocket(`ws://localhost:${port}`);
            messages = [];
            wsClient.on('message', (message) => {
                messages.push(JSON.parse(message));
            });
            await new Promise(resolve => wsClient.on('open', resolve));
        });

        afterEach(async () => {
            await CommunityPost.deleteMany({});
            wsClient.close();
        });

        it('should unlike a community post and broadcast a websocket event', (done) => {
            request(app)
                .put(`/api/community/${post._id}/unlike`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    if (res.body.likes.length !== 0) {
                        return done(new Error('Like count should be 0'));
                    }

                    setTimeout(() => {
                        if (messages.length === 0) {
                            return done(new Error('No WebSocket message received'));
                        }
                        const wsMessage = messages[0];
                        if (wsMessage.event !== 'community_post_unliked') {
                            return done(new Error('Incorrect WebSocket event'));
                        }
                        if (wsMessage.payload.postId !== post._id.toString()) {
                            return done(new Error('Incorrect post ID in WebSocket payload'));
                        }
                        if (wsMessage.payload.likes !== 0) {
                            return done(new Error('Incorrect like count in WebSocket payload'));
                        }
                        done();
                    }, 500);
                });
        });
    });

    describe('POST /api/community/:postId/comment', () => {
        let post;
        let wsClient;
        let messages = [];

        beforeEach(async () => {
            post = await CommunityPost.create({
                user: userId,
                content: 'A test post',
            });

            const port = server.address().port;
            wsClient = new WebSocket(`ws://localhost:${port}`);
            messages = [];
            wsClient.on('message', (message) => {
                messages.push(JSON.parse(message));
            });
            await new Promise(resolve => wsClient.on('open', resolve));
        });

        afterEach(async () => {
            await CommunityPost.deleteMany({});
            wsClient.close();
        });

        it('should add a comment to a community post and broadcast a websocket event', (done) => {
            request(app)
                .post(`/api/community/${post._id}/comment`)
                .set('Authorization', `Bearer ${token}`)
                .send({ content: 'This is a test comment' })
                .expect(201)
                .end((err, res) => {
                    if (err) return done(err);
                    if (res.body.comments.length !== 1) {
                        return done(new Error('Comment count should be 1'));
                    }
                    if (res.body.comments[0].content !== 'This is a test comment') {
                        return done(new Error('Comment content does not match'));
                    }

                    setTimeout(() => {
                        if (messages.length === 0) {
                            return done(new Error('No WebSocket message received'));
                        }
                        const wsMessage = messages[0];
                        if (wsMessage.event !== 'community_post_comment_added') {
                            return done(new Error('Incorrect WebSocket event'));
                        }
                        if (wsMessage.payload.postId !== post._id.toString()) {
                            return done(new Error('Incorrect post ID in WebSocket payload'));
                        }
                        if (wsMessage.payload.comment.content !== 'This is a test comment') {
                            return done(new Error('Incorrect comment content in WebSocket payload'));
                        }
                        done();
                    }, 500);
                });
        });
    });
});