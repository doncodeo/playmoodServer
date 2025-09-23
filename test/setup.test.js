const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/userModel');

const jwt = require('jsonwebtoken');

describe('Test Setup', function() {
  let mongoServer;

  before(async function() {
    this.timeout(120000);
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  after(async function() {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('should connect to the in-memory database', async function() {
    // This test is now implicitly covered by the before hook
  });

  it('should create a user in the database', async function() {
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password',
    });
    const foundUser = await User.findById(user._id);
    if (!foundUser) {
      throw new Error('User not found in database');
    }
  });

  it('should generate a JWT token', function() {
    const token = jwt.sign({ id: 'testid', role: 'testrole' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    if (!token) {
      throw new Error('Token not generated');
    }
  });
});
