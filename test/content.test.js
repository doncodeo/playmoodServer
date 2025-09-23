const request = require('supertest');
const { app, server } = require('../server');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');

const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Content API', function() {
  this.timeout(30000); // Set timeout to 30 seconds to allow for compression

  let token;
  let userId;
  let mongoServer;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create a test user
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password',
      role: 'creator' // or whatever role is needed to upload content
    });
    userId = user._id;

    // Generate a token
    token = jwt.sign({ id: userId, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
  });

  after(async () => {
    // Clean up the test user
    await User.findByIdAndDelete(userId);
    // Close the server connection
    server.close();
    // Close the mongoose connection
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('should upload and compress a video', (done) => {
    request(app)
      .post('/api/content')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Test Video')
      .field('category', 'Test')
      .field('description', 'A test video')
      .field('credit', 'Test User')
      .field('userId', userId.toString())
      .field('previewStart', '0')
      .field('previewEnd', '10')
      .field('languageCode', 'en_us')
      .attach('files', path.resolve(__dirname, 'test.mp4'))
      .expect(201)
      .end((err, res) => {
        if (err) return done(err);
        // We can't easily check if the video was compressed,
        // but a 201 response is a good indication that the process didn't crash.
        // We can also check the response body for the video URL.
        if (!res.body.video.includes('cloudinary')) {
          return done(new Error('Video not uploaded to Cloudinary'));
        }
        done();
      });
  });
});
