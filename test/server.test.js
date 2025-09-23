const request = require('supertest');
const { app } = require('../server');

describe('Server', function() {
  it('should start and respond to a simple request', (done) => {
    request(app)
      .get('/api/nonexistent')
      .expect(404)
      .end(done);
  });
});
