const Subscription = require('../models/subscribeModel');
const User = require('../models/userModel');
const Content = require('../models/contentModel');

// Subscribe to a creator
const subscribe = async (req, res) => {
    const { creatorId } = req.body;
    const subscriberId = req.user._id;

    try {
        // Check if the user is already subscribed
        const existingSubscription = await Subscription.findOne({ subscriber: subscriberId, creator: creatorId });
        if (existingSubscription) {
            return res.status(400).json({ message: 'Already subscribed to this creator.' });
        }

        // Create new subscription
        const subscription = new Subscription({
            subscriber: subscriberId,
            creator: creatorId,
        });
        await subscription.save();

        // Update subscriber and creator profiles
        await User.findByIdAndUpdate(subscriberId, {
            $push: { subscriptions: creatorId },
            $pull: { unfollowedCreators: { creatorId: creatorId } }
        });
        await User.findByIdAndUpdate(creatorId, { $push: { subscribers: subscriberId } });

        // Fetch updated subscriptions
        const user = await User.findById(subscriberId).populate('subscriptions', 'name email profileImage');

        res.status(201).json({
            message: 'Subscribed successfully.',
            subscriptions: user.subscriptions
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Unsubscribe from a creator
const unsubscribe = async (req, res) => {
    const { creatorId } = req.body;
    const subscriberId = req.user._id; // Assuming `req.user` is populated by middleware

    if (!creatorId) {
        return res.status(400).json({ message: 'Creator ID is required.' });
    }

    try {
        // Remove subscription
        const subscription = await Subscription.findOneAndDelete({
            subscriber: subscriberId,
            creator: creatorId,
        });

        if (!subscription) {
            return res.status(400).json({ message: 'Not subscribed to this creator.' });
        }

        // Update subscriber and creator profiles
        await User.findByIdAndUpdate(subscriberId, {
            $pull: { subscriptions: creatorId },
            $push: { unfollowedCreators: { creatorId: creatorId, unfollowedAt: new Date() } }
        });
        await User.findByIdAndUpdate(creatorId, { $pull: { subscribers: subscriberId } });

        // Fetch updated subscriptions
        const user = await User.findById(subscriberId).populate('subscriptions', 'name email profileImage');

        // Send response
        return res.status(200).json({
            message: 'Unsubscribed successfully.',
            subscriptions: user.subscriptions
        });
    } catch (error) {
        console.error('Unsubscribe Error:', error); // Log the error
        return res.status(500).json({ message: 'Server error', error });
    }
}; 

// Fetch content from subscribed creators
const getSubscribedContent = async (req, res) => {
    const userId = req.user._id;

    try {
        const user = await User.findById(userId).populate('subscriptions');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const subscribedCreatorIds = user.subscriptions.map(sub => sub._id);
        const contents = await Content.find({ user: { $in: subscribedCreatorIds } });

        res.status(200).json(contents);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Fetch all subscribers of a creator
const getSubscribers = async (req, res) => {
    const creatorId = req.user._id;

    try {
        const creator = await User.findById(creatorId).populate('subscribers', 'name email profileImage');
        if (!creator) {
            return res.status(404).json({ message: 'Creator not found.' });
        }

        res.status(200).json(creator.subscribers);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Get all creators a user is subscribed to
const getSubscribedCreators = async (req, res) => {
    const userId = req.user._id;

    try {
        const user = await User.findById(userId).populate('subscriptions', 'name email profileImage');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json(user.subscriptions);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

module.exports = {
    subscribe,
    unsubscribe,
    getSubscribedContent,
    getSubscribers,
    getSubscribedCreators,
};
