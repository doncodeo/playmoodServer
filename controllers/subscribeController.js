const Subscription = require('../models/subscribeModel');
const User = require('../models/userModel');

const subscribe = async (req, res) => {
    const { creatorId } = req.body;
    const subscriberId = req.user._id;

    try {
        const existingSubscription = await Subscription.findOne({ subscriber: subscriberId, creator: creatorId });
        if (existingSubscription) {
            return res.status(400).json({ message: 'Already subscribed to this creator.' });
        }

        const subscription = new Subscription({
            subscriber: subscriberId,
            creator: creatorId,
        }); 

        await subscription.save();
        await User.findByIdAndUpdate(subscriberId, { $push: { subscriptions: creatorId } });

        res.status(201).json({ message: 'Subscribed successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

const unsubscribe = async (req, res) => {
    const { creatorId } = req.body;
    const subscriberId = req.user._id;

    try {
        const subscription = await Subscription.findOneAndDelete({ subscriber: subscriberId, creator: creatorId });
        if (!subscription) {
            return res.status(400).json({ message: 'Not subscribed to this creator.' });
        }

        await User.findByIdAndUpdate(subscriberId, { $pull: { subscriptions: creatorId } });

        res.status(200).json({ message: 'Unsubscribed successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

module.exports = {
    subscribe,
    unsubscribe
};
 