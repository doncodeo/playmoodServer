const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const FeedPost = require('../models/feedPostModel');
const Highlight = require('../models/highlightModel');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sinon = require('sinon');
const { initWebSocket, closeWebSocket } = require('../websocket');

describe('Feed API', function() {
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
      email: 'creator@example.com',
      password: 'password',
      role: 'creator',
      feedSettings: {
          feedPosts: true,
          thumbnails: true,
          shortPreviews: true,
          highlights: true
      }
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
    await Content.deleteMany({});
    await Highlight.deleteMany({});
  });

  describe('GET /api/feed/user/:userId', () => {
    it('should return combined feed for a creator', async () => {
      // Create a FeedPost
      await FeedPost.create({
        user: creatorId,
        caption: 'Test Feed Post',
        type: 'image',
        media: [{ url: 'http://example.com/image.jpg' }]
      });

      // Create a Content (Thumbnail)
      await Content.create({
        user: creatorId,
        title: 'Test Video',
        category: 'Test',
        description: 'Test',
        credit: 'Test',
        video: 'http://example.com/video.mp4',
        thumbnail: 'http://example.com/thumb.jpg',
        isApproved: true
      });

      const res = await request(app)
        .get(`/api/feed/user/${creatorId}`)
        .expect(200);

      if (res.body.length !== 2) {
          throw new Error(`Expected 2 items in feed, got ${res.body.length}`);
      }

      const feedTypes = res.body.map(item => item.feedType);
      if (!feedTypes.includes('feedPost') || !feedTypes.includes('thumbnail')) {
          throw new Error('Missing expected feed types');
      }
    });

    it('should respect feedSettings', async () => {
        // Update settings to only show feedPosts
        await User.findByIdAndUpdate(creatorId, {
            'feedSettings.thumbnails': false,
            'feedSettings.shortPreviews': false,
            'feedSettings.highlights': false
        });

        await FeedPost.create({
            user: creatorId,
            caption: 'Test Feed Post',
            type: 'image',
            media: [{ url: 'http://example.com/image.jpg' }]
        });

        await Content.create({
            user: creatorId,
            title: 'Test Video',
            category: 'Test',
            description: 'Test',
            credit: 'Test',
            video: 'http://example.com/video.mp4',
            thumbnail: 'http://example.com/thumb.jpg',
            isApproved: true
        });

        const res = await request(app)
            .get(`/api/feed/user/${creatorId}`)
            .expect(200);

        if (res.body.length !== 1) {
            throw new Error(`Expected 1 item in feed, got ${res.body.length}`);
        }
        if (res.body[0].feedType !== 'feedPost') {
            throw new Error('Expected only feedPost');
        }

        // Restore settings
        await User.findByIdAndUpdate(creatorId, {
            'feedSettings.thumbnails': true,
            'feedSettings.shortPreviews': true,
            'feedSettings.highlights': true
        });
    });
  });

  describe('GET /api/feed/all', () => {
      it('should return randomized feed from all creators', async () => {
          await FeedPost.create({
              user: creatorId,
              caption: 'Test Feed Post',
              type: 'image',
              media: [{ url: 'http://example.com/image.jpg' }]
          });

          const res = await request(app)
              .get('/api/feed/all')
              .expect(200);

          if (!res.body.feed || res.body.feed.length === 0) {
              throw new Error('Feed should not be empty');
          }
      });
  });

  describe('CRUD operations', () => {
    let postId;

    beforeEach(async () => {
        const post = await FeedPost.create({
            user: creatorId,
            caption: 'Original Caption',
            type: 'image',
            media: [{ url: 'http://example.com/image.jpg' }]
        });
        postId = post._id;
    });

    it('should update a feed post', async () => {
        const res = await request(app)
            .put(`/api/feed/${postId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ caption: 'Updated Caption' })
            .expect(200);

        if (res.body.caption !== 'Updated Caption') {
            throw new Error('Caption not updated');
        }
    });

    it('should delete a feed post', async () => {
        await request(app)
            .delete(`/api/feed/${postId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        const post = await FeedPost.findById(postId);
        if (post) {
            throw new Error('Post still exists');
        }
    });

    it('should add and delete a comment', async () => {
        const commentRes = await request(app)
            .post(`/api/feed/${postId}/comment`)
            .set('Authorization', `Bearer ${token}`)
            .send({ text: 'Test Comment' })
            .expect(201);

        const commentId = commentRes.body._id;

        await request(app)
            .delete(`/api/feed/${postId}/comment/${commentId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        const post = await FeedPost.findById(postId);
        if (post.comments.length !== 0) {
            throw new Error('Comment not deleted');
        }
    });

    it('should track unique views', async () => {
        // First view
        await request(app)
            .put(`/api/feed/${postId}/view`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        // Second view from same user
        await request(app)
            .put(`/api/feed/${postId}/view`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        const post = await FeedPost.findById(postId);
        if (post.views !== 1) {
            throw new Error(`Expected 1 view, got ${post.views}`);
        }
    });
  });
});
