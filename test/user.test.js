const assert = require('assert');
const sinon = require('sinon');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/userModel');
const Subscription = require('../models/subscribeModel');
const { getUser, getUserprofile } = require('../controllers/userController');

describe('User Controller Unit Tests', () => {
    let creator;
    let subscriber;
    let mongoServer;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create users and subscription for this test suite
        creator = new User({ name: 'Creator', email: 'creator.user.test@example.com', password: 'password123', profileImage: 'https://example.com/profile.jpg' });
        subscriber = new User({ name: 'Subscriber', email: 'subscriber.user.test@example.com', password: 'password123' });
        await creator.save();
        await subscriber.save();

        // Create a subscription relationship
        await new Subscription({ subscriber: subscriber._id, creator: creator._id }).save();
        subscriber.subscriptions.push(creator._id);
        await subscriber.save();
    });

    after(async () => {
        // Clean up data created for this test suite
        await User.deleteMany({ email: { $in: ['creator.user.test@example.com', 'subscriber.user.test@example.com'] } });
        await Subscription.deleteMany({ subscriber: subscriber._id });
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    it('getUser should return users with populated subscriptions', async () => {
        const req = {};
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.spy(),
        };

        await getUser(req, res);

        assert(res.status.calledWith(200));
        const users = res.json.firstCall.args[0];
        const testedUser = users.find(u => u._id.equals(subscriber._id));

        assert.ok(testedUser, 'Subscriber not found in getUser response');
        assert.strictEqual(testedUser.subscriptions.length, 1);
        assert.strictEqual(testedUser.subscriptions[0].name, 'Creator');
        assert.ok(testedUser.subscriptions[0].email, 'Subscribed creator email should be populated');
        assert.ok(testedUser.subscriptions[0].profileImage, 'Subscribed creator profileImage should be populated');
    });

    it('getUserprofile should return a single user with populated subscriptions', async () => {
        const req = {
            user: { id: subscriber._id } // Mock the authenticated user
        };
        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.spy(),
        };

        await getUserprofile(req, res);

        assert(res.status.calledWith(200));
        const userProfile = res.json.firstCall.args[0];

        assert.ok(userProfile, 'User profile not returned');
        assert.strictEqual(userProfile.subscriptions.length, 1);
        assert.strictEqual(userProfile.subscriptions[0].name, 'Creator');
        assert.ok(userProfile.subscriptions[0].email, 'Subscribed creator email should be populated');
        assert.ok(userProfile.subscriptions[0].profileImage, 'Subscribed creator profileImage should be populated');
    });
});