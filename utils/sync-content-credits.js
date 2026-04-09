const mongoose = require('mongoose');
const dotenv = require('dotenv').config();
const Content = require('../models/contentModel');
const User = require('../models/userModel');

const syncCredits = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('MONGO_URI is not defined in environment variables.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        const users = await User.find().select('name');
        console.log(`Found ${users.length} users to process.`);

        let totalUpdated = 0;
        for (const user of users) {
            const result = await Content.updateMany(
                { user: user._id, credit: { $ne: user.name } },
                { $set: { credit: user.name } }
            );
            totalUpdated += result.modifiedCount;
        }

        // Handle content with no user (fallback)
        const fallbackResult = await Content.updateMany(
            { user: { $exists: false }, credit: { $ne: 'PlaymoodTv' } },
            { $set: { credit: 'PlaymoodTv' } }
        );
        totalUpdated += fallbackResult.modifiedCount;

        // Also handle cases where user is null (orphaned content)
        const orphanedResult = await Content.updateMany(
            { user: null, credit: { $ne: 'PlaymoodTv' } },
            { $set: { credit: 'PlaymoodTv' } }
        );
        totalUpdated += orphanedResult.modifiedCount;

        console.log(`Successfully updated ${totalUpdated} content items.`);
        process.exit(0);
    } catch (error) {
        console.error('Error syncing credits:', error);
        process.exit(1);
    }
};

syncCredits();
