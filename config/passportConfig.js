const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userData = require('../models/userModel'); 
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if the user already exists in the database
        let user = await userData.findOne({ email: profile.emails[0].value });

        if (!user) {
          // If the user does not exist, create a new user
          user = await userData.create({
            name: profile.displayName,
            email: profile.emails[0].value,
            profileImage: profile.photos[0].value,
            cloudinary_id: 'default_cloudinary_id', // Adjust as needed
            password: '', // Password can be empty or null for Google-authenticated users
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await userData.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
