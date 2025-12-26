const express = require('express');
const passport = require('passport');
const router = express.Router();

const User = require('../models/User');

const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
// const AppleStrategy = require('passport-apple');


// ===============================
// SERIALIZE USER
// ===============================
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});


// ===============================
// GOOGLE STRATEGY
// ===============================
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {

  try {
    const email = profile.emails?.[0]?.value;
    const avatar = profile.photos?.[0]?.value;

    let user = await User.findOne({
      $or: [{ googleId: profile.id }, { email }]
    });

    if (!user) {
      user = await User.create({
        googleId: profile.id,
        name: profile.displayName,
        email,
        avatar
      });
    } else {
      user.googleId = profile.id;
      if (!user.avatar && avatar) user.avatar = avatar;
      await user.save();
    }

    return done(null, user);

  } catch (err) {
    return done(err, null);
  }
}));


// ===============================
// FACEBOOK STRATEGY
// ===============================
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL,
  profileFields: ['id', 'displayName', 'photos', 'email']
}, async (accessToken, refreshToken, profile, done) => {

  try {
    const email = profile.emails?.[0]?.value;
    const avatar = profile.photos?.[0]?.value;

    let user = await User.findOne({
      $or: [{ facebookId: profile.id }, { email }]
    });

    if (!user) {
      user = await User.create({
        facebookId: profile.id,
        name: profile.displayName,
        email,
        avatar
      });
    } else {
      user.facebookId = profile.id;
      if (!user.avatar && avatar) user.avatar = avatar;
      await user.save();
    }

    return done(null, user);

  } catch (err) {
    return done(err, null);
  }
}));


// ===============================
// APPLE STRATEGY
// ===============================
/*passport.use(new AppleStrategy({
  clientID: process.env.APPLE_CLIENT_ID,
  teamID: process.env.APPLE_TEAM_ID,
  keyID: process.env.APPLE_KEY_ID,
  key: require('fs').readFileSync(process.env.APPLE_PRIVATE_KEY_PATH),
  callbackURL: process.env.APPLE_CALLBACK_URL,
  scope: ['name', 'email']
}, async (accessToken, refreshToken, idToken, profile, done) => {

  try {
    const appleId = profile.id;
    const email = profile.email;
    const name = profile.name ? `${profile.name.firstName} ${profile.name.lastName}` : 'Apple User';

    let user = await User.findOne({
      $or: [{ appleId }, { email }]
    });

    if (!user) {
      user = await User.create({
        appleId,
        name,
        email
      });
    } else {
      user.appleId = appleId;
      await user.save();
    }

    return done(null, user);

  } catch (err) {
    return done(err, null);
  }
}));
*/

// ===============================
// ROUTES
// ===============================

// GOOGLE
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => {

    req.session.user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar
    };

    res.redirect('/homepage.html');
  }
);


// FACEBOOK
router.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login.html' }),
  (req, res) => {

    req.session.user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar
    };

    res.redirect('/homepage.html');
  }
);


// APPLE
/*
router.get('/auth/apple', passport.authenticate('apple'));

router.post('/auth/apple/callback',
  passport.authenticate('apple', { failureRedirect: '/login.html' }),
  (req, res) => {

    req.session.user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email
    };

    res.redirect('/homepage.html');
  }
);
*/

module.exports = router;
