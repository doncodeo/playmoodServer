const assert = require('assert');
const sinon = require('sinon');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/userModel');
const Subscription = require('../models/subscribeModel');
const { subscribe, unsubscribe, getSubscribedCreators } = require('../controllers/subscribeController');

describe('Subscription Controller Unit Tests', () => {
    let creator;
    let subscriber;
    let mongoServer;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create users for this test suite
        creator = new User({ name: 'Creator', email: 'creator.sub.test@example.com', password: 'password123' });
        subscriber = new User({ name: 'Subscriber', email: 'subscriber.sub.test@example.com', password: 'password123' });
        await creator.save();
        await subscriber.save();
    });

    after(async () => {
        // Clean up users created in this suite
        await User.deleteMany({ email: { $in: ['creator.sub.test@example.com', 'subscriber.sub.test@example.com'] } });
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    afterEach(async () => {
        // Clean up subscriptions after each test
        await Subscription.deleteMany({});
        await User.updateMany({ _id: { $in: [subscriber._id, creator._id] } }, { $set: { subscriptions: [], subscribers: [] } });
    });

    it('should allow a user to subscribe to a creator', async () => {
        const req = {
            user: { _id: subscriber._id },
            body: { creatorId: creator._id },
        };

        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.spy(),
        };

        await subscribe(req, res);

        assert(res.status.calledWith(201));
        const responseBody = res.json.firstCall.args[0];
        assert.strictEqual(responseBody.message, 'Subscribed successfully.');
        assert.strictEqual(responseBody.subscriptions.length, 1);
        assert.strictEqual(responseBody.subscriptions[0].name, 'Creator');

        const subscription = await Subscription.findOne({ subscriber: subscriber._id, creator: creator._id });
        assert.ok(subscription);
    });

    it('should allow a user to unsubscribe from a creator', async () => {
        await new Subscription({ subscriber: subscriber._id, creator: creator._id }).save();
        await User.findByIdAndUpdate(subscriber._id, { $push: { subscriptions: creator._id } });

        const req = {
            user: { _id: subscriber._id },
            body: { creatorId: creator._id },
        };

        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.spy(),
        };

        await unsubscribe(req, res);

        assert(res.status.calledWith(200));
        const responseBody = res.json.firstCall.args[0];
        assert.strictEqual(responseBody.message, 'Unsubscribed successfully.');
        assert.strictEqual(responseBody.subscriptions.length, 0);

        const subscription = await Subscription.findOne({ subscriber: subscriber._id, creator: creator._id });
        assert.strictEqual(subscription, null);
    });

    it('should return a list of subscribed creators', async () => {
        await new Subscription({ subscriber: subscriber._id, creator: creator._id }).save();
        await User.findByIdAndUpdate(subscriber._id, { $push: { subscriptions: creator._id } });

        const req = {
            user: { _id: subscriber._id },
        };

        const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.spy(),
        };

        await getSubscribedCreators(req, res);

        assert(res.status.calledWith(200));
        const responseBody = res.json.firstCall.args[0];
        assert.strictEqual(responseBody.length, 1);
        assert.strictEqual(responseBody[0].name, 'Creator');
    });
});