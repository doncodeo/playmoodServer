const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const Playlist = require('../models/playlistModel');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { initWebSocket, closeWebSocket } = require('../websocket');
const sinon = require('sinon');
const uploadQueue = require('../config/queue');

describe('Playlist API Duplicate Prevention', function() {
    this.timeout(60000);

    let app, server;
    let token;
    let userId;
    let mongoServer;
    let runningServer;
    let addStub;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        process.env.MONGO_URI = mongoUri;
        process.env.JWT_SECRET = 'test_secret';
        await mongoose.connect(mongoUri);

        const serverModule = require('../server');
        app = serverModule.app;
        server = serverModule.server;

        await new Promise(resolve => {
            runningServer = server.listen(0, resolve);
        });
        initWebSocket(runningServer);

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

        addStub = sinon.stub(uploadQueue, 'add');
    });

    after(function(done) {
        this.timeout(20000);
        if (addStub) addStub.restore();
        closeWebSocket(() => {
            if (runningServer) {
                runningServer.close(async () => {
                    await mongoose.disconnect();
                    await mongoServer.stop();
                    done();
                });
            } else {
                mongoose.disconnect().then(() => mongoServer.stop()).then(() => done());
            }
        });
    });

    it('should NOT allow adding the same video to a playlist twice', async () => {
        // 1. Create content
        const content = await Content.create({
            user: userId,
            title: 'Test Video',
            category: 'Test',
            description: 'A test video',
            credit: 'Test Creator',
            video: 'http://example.com/video.mp4',
            isApproved: true
        });

        // 2. Create playlist
        const playlistRes = await request(app)
            .post('/api/playlists')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Test Playlist',
                visibility: 'public'
            });

        const playlistId = playlistRes.body.playlist._id;

        // 3. Add video to playlist first time
        await request(app)
            .post(`/api/playlists/${playlistId}/videos/${content._id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        // 4. Add video to playlist second time - SHOULD FAIL
        const duplicateRes = await request(app)
            .post(`/api/playlists/${playlistId}/videos/${content._id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(400);

        if (duplicateRes.body.error !== 'Video already in playlist') {
            throw new Error(`Expected error message "Video already in playlist", but got "${duplicateRes.body.error}"`);
        }

        // 5. Verify playlist only has 1 video
        const getPlaylistRes = await request(app)
            .get(`/api/playlists/${playlistId}`)
            .expect(200);

        if (getPlaylistRes.body.playlist.videos.length !== 1) {
            throw new Error(`Expected 1 video in playlist, but got ${getPlaylistRes.body.playlist.videos.length}`);
        }
    });
});
