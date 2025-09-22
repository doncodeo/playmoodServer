const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const User = require('../models/userModel');

module.exports = function(passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        const googleUser = {
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          profileImage: profile.photos[0].value,
        };

        try {
          // Find a user by googleId or email
          let user = await User.findOne({
            $or: [{ googleId: profile.id }, { email: googleUser.email }],
          });

          if (user) {
            // User exists.
            // If they don't have a googleId, it means they logged in via another method.
            // Link their Google account.
            if (!user.googleId) {
              user.googleId = profile.id;
              user.profileImage = user.profileImage || googleUser.profileImage; // Update image if they don't have one
              await user.save();
            }
            return done(null, user);
          } else {
            // No user found, this is a new user.
            user = await User.create(googleUser);
            return done(null, user);
          }
        } catch (err) {
          console.error('Error in Google OAuth strategy:', err);
          return done(err, null); // Pass the error to done()
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => done(err, user));
  });
};
