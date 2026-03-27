const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const FeedPost = require('../models/feedPostModel');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { initWebSocket, closeWebSocket } = require('../websocket');

describe('Feed Image Toggle API', function() {
  this.timeout(60000);

  let app, server;
  let token;
  let creatorId;
  let mongoServer;
  let runningServer;

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

    const creator = await User.create({
      name: 'Creator User',
      email: 'creator_toggle@example.com',
      password: 'password',
      role: 'creator',
    });
    creatorId = creator._id;

    token = jwt.sign({ id: creatorId, role: creator.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
  });

  after(function(done) {
    this.timeout(20000);
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

  beforeEach(async () => {
    await FeedPost.deleteMany({});
  });

  describe('Toggle OFF (Default)', () => {
    before(() => {
        delete process.env.ENABLE_IMAGE_FEEDPOSTS;
    });

    it('should prevent creating image feed posts', async () => {
      const res = await request(app)
        .post('/api/feed')
        .set('Authorization', `Bearer ${token}`)
        .send({
            caption: 'Image Post',
            type: 'image',
            media: [{ url: 'http://example.com/image.jpg' }]
        })
        .expect(400);

      if (res.body.message !== 'Image posts are temporarily disabled. Please upload a video instead.') {
          throw new Error(`Unexpected error message: ${res.body.message}`);
      }
    });

    it('should allow creating video feed posts', async () => {
        await request(app)
          .post('/api/feed')
          .set('Authorization', `Bearer ${token}`)
          .send({
              caption: 'Video Post',
              type: 'video',
              media: [{ url: 'http://example.com/video.mp4', provider: 'cloudinary', public_id: '123' }]
          })
          .expect(201);
    });

    it('should hide existing image feed posts from creator feed', async () => {
        // Manually create an image post in DB
        await FeedPost.create({
            user: creatorId,
            caption: 'Hidden Image',
            type: 'image',
            media: [{ url: 'http://example.com/image.jpg' }]
        });

        // Create a video post
        await FeedPost.create({
            user: creatorId,
            caption: 'Visible Video',
            type: 'video',
            media: [{ url: 'http://example.com/video.mp4' }]
        });

        const res = await request(app)
            .get(`/api/feed/user/${creatorId}`)
            .expect(200);

        if (res.body.length !== 1) {
            throw new Error(`Expected 1 item, got ${res.body.length}`);
        }
        if (res.body[0].type !== 'video') {
            throw new Error(`Expected video post, got ${res.body[0].type}`);
        }
    });

    it('should hide existing image feed posts from global feed', async () => {
        // Manually create an image post in DB
        await FeedPost.create({
            user: creatorId,
            caption: 'Hidden Image',
            type: 'image',
            media: [{ url: 'http://example.com/image.jpg' }]
        });

        const res = await request(app)
            .get('/api/feed/all')
            .expect(200);

        if (res.body.feed.length !== 0) {
            throw new Error(`Expected 0 items, got ${res.body.feed.length}`);
        }
    });
  });

  describe('Toggle ON', () => {
    before(() => {
        process.env.ENABLE_IMAGE_FEEDPOSTS = 'true';
    });

    after(() => {
        delete process.env.ENABLE_IMAGE_FEEDPOSTS;
    });

    it('should allow creating image feed posts', async () => {
      await request(app)
        .post('/api/feed')
        .set('Authorization', `Bearer ${token}`)
        .send({
            caption: 'Image Post',
            type: 'image',
            media: [{ url: 'http://example.com/image.jpg' }]
        })
        .expect(201);
    });

    it('should show image feed posts in creator feed', async () => {
        await FeedPost.create({
            user: creatorId,
            caption: 'Visible Image',
            type: 'image',
            media: [{ url: 'http://example.com/image.jpg' }]
        });

        const res = await request(app)
            .get(`/api/feed/user/${creatorId}`)
            .expect(200);

        if (res.body.length === 0) {
            throw new Error('Expected at least 1 item');
        }
        if (!res.body.some(p => p.type === 'image')) {
            throw new Error('Image post not found in feed');
        }
    });
  });
});
