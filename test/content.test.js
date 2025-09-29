const request = require('supertest');
const { app, server } = require('../server');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');

const { MongoMemoryServer } = require('mongodb-memory-server');
const uploadQueue = require('../config/queue');
const sinon = require('sinon');

describe('Content API', function() {
  this.timeout(60000);

  let token;
  let userId;
  let mongoServer;
  let runningServer;
  let addStub;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    await mongoose.connect(mongoUri);

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

    // Mock the queue
    addStub = sinon.stub(uploadQueue, 'add');

    // Start the server for testing
    runningServer = app.listen(0);
  });

  after(async () => {
    await User.findByIdAndDelete(userId);
    await mongoose.disconnect();
    await mongoServer.stop();
    addStub.restore(); // Restore the original method
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
});
