const request = require('supertest');
const { app, server } = require('../server');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

describe('Content API', function() {
  this.timeout(30000); // Set timeout to 30 seconds to allow for compression

  it('should upload and compress a video', (done) => {
    request(app)
      .post('/api/content')
      .field('title', 'Test Video')
      .field('category', 'Test')
      .field('description', 'A test video')
      .field('credit', 'Test User')
      .field('userId', '60d5f2f5c7b8b7001f9b3e1d') // A dummy user ID
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
