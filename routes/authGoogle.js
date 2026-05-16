const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
const { redirect } = require('next/dist/server/api-utils');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// ------------------- Passport Config -------------------
passport.use(new GoogleStrategy(
{
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const photo = profile.photos?.[0]?.value || null;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        googleId: profile.id,
        name: profile.displayName,
        email: email,
        avatar: photo   // ✅ SAVE PHOTO
      });
    } else {
      // ✅ UPDATE PHOTO IF CHANGED
      if (photo && user.avatar !== photo) {
        user.avatar = photo;
        await user.save();
      }
    }

    return done(null, user);

  } catch (err) {
    done(err, null);
  }
}));

// ------------------- Serialize / Deserialize -------------------
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

// ------------------- Routes -------------------

// Start Google login
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => {
    // Set session for frontend
    req.session.user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar
    };

    console.log("✅ Google login - Session before save:", req.session);
    // Save session before redirecting
    req.session.save((err) => {
      if (err) {
        console.error("❌ Session save error:", err);
        return res.redirect('/login.html');
      }
      console.log("✅ Google login - Session saved successfully");
      console.log("Session ID:", req.sessionID);
      console.log("Session data:", req.session);
      res.redirect('/homepage.html');
    });
  }
);

module.exports = router;
