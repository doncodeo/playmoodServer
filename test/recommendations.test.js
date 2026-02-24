const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { initWebSocket, closeWebSocket } = require('../websocket');

describe('Recommendation API', function() {
  this.timeout(60000);

  let app, server;
  let token;
  let userId;
  let mongoServer;
  let runningServer;
  let contentId;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
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
      role: 'user'
    });
    userId = user._id;

    token = jwt.sign({ id: userId, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    // Create some approved content
    const content = await Content.create({
      user: userId,
      title: 'Approved Content 1',
      category: 'Entertainment',
      description: 'Test description',
      credit: 'Test Credit',
      video: 'https://example.com/video1.mp4',
      isApproved: true
    });
    contentId = content._id;

    await Content.create({
      user: userId,
      title: 'Approved Content 2',
      category: 'Entertainment',
      description: 'Test description 2',
      credit: 'Test Credit 2',
      video: 'https://example.com/video2.mp4',
      isApproved: true
    });
  });

  after(async () => {
    await new Promise(resolve => {
        closeWebSocket(() => {
            if (runningServer) {
                runningServer.close(async () => {
                    await mongoose.disconnect();
                    await mongoServer.stop();
                    resolve();
                });
            } else {
                mongoose.disconnect().then(() => mongoServer.stop()).then(() => resolve());
            }
        });
    });
  });

  describe('GET /api/content/homepage-feed', () => {
    it('should return recommendations for anonymous user with specific fields only', (done) => {
      request(app)
        .get('/api/content/homepage-feed')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          if (!Array.isArray(res.body)) {
            return done(new Error('Response should be an array'));
          }
          if (res.body.length > 0) {
            const item = res.body[0];
            if (item.contentEmbedding) return done(new Error('contentEmbedding should not be returned'));
            if (item.captions) return done(new Error('captions should not be returned'));
            if (!item.title) return done(new Error('title should be returned'));
            if (!item.user || typeof item.user !== 'object') return done(new Error('user should be a populated object'));
          }
          done();
        });
    });

    it('should return recommendations for logged-in user', (done) => {
      request(app)
        .get('/api/content/homepage-feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          if (!Array.isArray(res.body)) {
            return done(new Error('Response should be an array'));
          }
          done();
        });
    });
  });

  describe('GET /api/content/recommended/:id', () => {
    it('should return recommendations for anonymous user', (done) => {
      request(app)
        .get(`/api/content/recommended/${contentId}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          if (!Array.isArray(res.body)) {
            return done(new Error('Response should be an array'));
          }
          done();
        });
    });

    it('should return recommendations for logged-in user', (done) => {
      request(app)
        .get(`/api/content/recommended/${contentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          if (!Array.isArray(res.body)) {
            return done(new Error('Response should be an array'));
          }
          done();
        });
    });

    it('should return 404 for non-existent content id', (done) => {
      const fakeId = new mongoose.Types.ObjectId();
      request(app)
        .get(`/api/content/recommended/${fakeId}`)
        .expect(404, done);
    });
  });
});
