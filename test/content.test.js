const request = require('supertest');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const Highlight = require('../models/highlightModel');
const aiService = require('../ai/ai-service');
const jwt =require('jsonwebtoken');

const { MongoMemoryServer } = require('mongodb-memory-server');
const uploadQueue = require('../config/queue');
const sinon = require('sinon');
const { initWebSocket } = require('../websocket');

describe('Content API', function() {
  this.timeout(60000);

  let app, server;
  let token;
  let adminToken;
  let userId;
  let mongoServer;
  let runningServer;
  let addStub;
  let getVideoDurationStub;
  let generateHighlightStub;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    await mongoose.connect(mongoUri);

    const serverModule = require('../server');
    app = serverModule.app;
    server = serverModule.server;
    initWebSocket(server);

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

    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password',
      role: 'admin',
    });
    adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    // Mock the queue
    addStub = sinon.stub(uploadQueue, 'add');

    // Stub AI service methods
    getVideoDurationStub = sinon.stub(aiService, 'getVideoDuration').resolves(120);
    generateHighlightStub = sinon.stub(aiService, 'generateHighlight').returns({ startTime: 10, endTime: 25 });

    runningServer = server;
  });

  after(async () => {
    await User.deleteMany({});
    await mongoose.disconnect();
    await mongoServer.stop();
    addStub.restore(); // Restore the original method
    getVideoDurationStub.restore();
    generateHighlightStub.restore();
    if (runningServer) {
      await new Promise(resolve => runningServer.close(resolve));
    }
  });

  it('should create a content record and queue it for processing', (done) => {
    const mockVideoData = {
      public_id: 'test/video123',
      url: 'http://res.cloudinary.com/demo/video/upload/test/video123.mp4',
    };

    const mockThumbnailData = {
      public_id: 'test/thumb456',
      url: 'http://res.cloudinary.com/demo/image/upload/test/thumb456.jpg',
    };

    request(app)
      .post('/api/content')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Video',
        category: 'Test',
        description: 'A test video',
        credit: 'Test User',
        previewStart: '0',
        previewEnd: '10',
        languageCode: 'en_us',
        video: mockVideoData,
        thumbnail: mockThumbnailData,
      })
      .expect(202)
      .end((err, res) => {
        if (err) return done(err);

        if (res.body.status !== 'processing') {
          return done(new Error('Content status should be "processing"'));
        }
        done();
      });
  });

  describe('POST /api/content/signature', () => {
    it('should generate a signature for mixed content when no type is specified', (done) => {
      request(app)
        .post('/api/content/signature')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          if (!res.body.signature || !res.body.timestamp || !res.body.folder || !res.body.api_key) {
            return done(new Error('Missing required signature fields'));
          }
          if (res.body.folder !== `user-uploads/${userId}/mixed`) {
            return done(new Error('Incorrect folder for mixed content'));
          }
          done();
        });
    });

    it('should generate a signature for videos', (done) => {
      request(app)
        .post('/api/content/signature')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'videos' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          if (res.body.folder !== `user-uploads/${userId}/videos`) {
            return done(new Error('Incorrect folder for videos'));
          }
          done();
        });
    });

    it('should generate a signature for images', (done) => {
      request(app)
        .post('/api/content/signature')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'images' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          if (res.body.folder !== `user-uploads/${userId}/images`) {
            return done(new Error('Incorrect folder for images'));
          }
          done();
        });
    });

    it('should handle invalid type by defaulting to mixed', (done) => {
      request(app)
        .post('/api/content/signature')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'invalid' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          if (res.body.folder !== `user-uploads/${userId}/mixed`) {
            return done(new Error('Incorrect folder for invalid type'));
          }
          done();
        });
    });
  });

  describe('PUT /api/content/approve/:id', () => {
    let unapprovedContent;

    beforeEach(async () => {
      unapprovedContent = await Content.create({
        user: userId,
        title: 'Unapproved Video',
        category: 'Test',
        description: 'An unapproved test video',
        credit: 'Test User',
        video: 'http://res.cloudinary.com/demo/video/upload/unapproved.mp4',
        cloudinary_video_id: 'unapproved_video_id',
        isApproved: false,
      });
    });

    afterEach(async () => {
      await Content.deleteMany({});
      await Highlight.deleteMany({});
    });

    it('should approve content and create a highlight', (done) => {
      request(app)
        .put(`/api/content/approve/${unapprovedContent._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Approved Title' })
        .expect(200)
        .end(async (err, res) => {
          if (err) return done(err);

          try {
            if (res.body.message !== 'Content approved and updated successfully') {
                throw new Error('Incorrect approval message');
            }
            if (res.body.content.isApproved !== true) {
                throw new Error('Content should be approved in response');
            }

            // Wait for the highlight to be created by the worker
            let updatedContent;
            for (let i = 0; i < 10; i++) {
                updatedContent = await Content.findById(unapprovedContent._id);
                if (updatedContent.highlights && updatedContent.highlights.length > 0) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms
            }

            if (!updatedContent.isApproved) {
                throw new Error('Content not approved in DB');
            }
            if (!updatedContent.highlights || updatedContent.highlights.length === 0) {
                throw new Error('Highlight not linked in content');
            }

            const highlight = await Highlight.findById(updatedContent.highlights[0]);
            if (!highlight) {
                throw new Error('Highlight document not created');
            }
            if (highlight.content.toString() !== updatedContent._id.toString()) {
                throw new Error('Highlight not linked correctly to content');
            }

            done();
          } catch (e) {
            done(e);
          }
        });
    });
  });

    describe('PUT /api/content/:id/like', () => {
        let content;

        beforeEach(async () => {
            content = await Content.create({
                user: userId,
                title: 'Test Video',
                category: 'Test',
                description: 'A test video',
                credit: 'Test User',
                video: 'http://res.cloudinary.com/demo/video/upload/test.mp4',
                cloudinary_video_id: 'test_video_id',
                isApproved: true,
            });
        });

        afterEach(async () => {
            await Content.deleteMany({});
        });

        it('should like a content item', (done) => {
            request(app)
                .put(`/api/content/${content._id}/like`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    if (res.body.message !== 'Content liked successfully') {
                        return done(new Error('Incorrect like message'));
                    }
                    if (res.body.likes.length !== 1) {
                        return done(new Error('Like count should be 1'));
                    }
                    if (res.body.likes[0] !== userId.toString()) {
                        return done(new Error('User ID not added to likes'));
                    }
                    done();
                });
        });
    });

    describe('PUT /api/content/:id/unlike', () => {
        let content;

        beforeEach(async () => {
            content = await Content.create({
                user: userId,
                title: 'Test Video',
                category: 'Test',
                description: 'A test video',
                credit: 'Test User',
                video: 'http://res.cloudinary.com/demo/video/upload/test.mp4',
                cloudinary_video_id: 'test_video_id',
                isApproved: true,
                likes: [userId],
            });
        });

        afterEach(async () => {
            await Content.deleteMany({});
        });

        it('should unlike a content item', (done) => {
            request(app)
                .put(`/api/content/${content._id}/unlike`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    if (res.body.message !== 'Content unliked successfully') {
                        return done(new Error('Incorrect unlike message'));
                    }
                    if (res.body.likes.length !== 0) {
                        return done(new Error('Like count should be 0'));
                    }
                    done();
                });
        });
    });
});