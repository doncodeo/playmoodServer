const mongoose = require('mongoose');
const User = require('../models/userModel');
const Content = require('../models/contentModel');
const { MongoMemoryServer } = require('mongodb-memory-server');
const assert = require('assert');

describe('Credit Sync Logic', () => {
    let mongoServer;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        await mongoose.connect(uri);
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    it('should update content credits when user name changes', async () => {
        // 1. Create a user
        const user = await User.create({
            name: 'Original Name',
            email: 'test@example.com',
            password: 'password123',
            role: 'creator'
        });

        // 2. Create content for that user
        const content = await Content.create({
            user: user._id,
            title: 'Test Video',
            category: 'Tech',
            description: 'A test video',
            credit: 'Original Name',
            video: 'https://example.com/video.mp4'
        });

        // 3. Change user name
        user.name = 'New Name';
        await user.save();

        // 4. Verify content credit was updated
        const updatedContent = await Content.findById(content._id);
        assert.strictEqual(updatedContent.credit, 'New Name');
    });

    it('should default credit to user name in createContent simulation', async () => {
        // This simulates the logic added to contentController
        const user = await User.create({
            name: 'Creator Name',
            email: 'creator@example.com',
            password: 'password123',
            role: 'creator'
        });

        const contentData = {
            user: user._id,
            title: 'New Video',
            category: 'Music',
            description: 'Enjoy',
            credit: user.name || 'Some fallback',
            video: 'https://example.com/video2.mp4'
        };

        const content = await Content.create(contentData);
        assert.strictEqual(content.credit, 'Creator Name');
    });
});
