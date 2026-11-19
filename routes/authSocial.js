
const express = require('express');
const passport = require('passport');
const router = express.Router();

const User = require('../models/User');

const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;


const crypto = require('crypto');

const GOOGLE_STATE_COOKIE = 'vv_google_oauth_nonce';
const GOOGLE_STATE_MAX_AGE = 10 * 60 * 1000;

function getOAuthStateSecret() {
  const environment = process.env.VERCEL_ENV || 'development';

  const secret = environment === 'production'
    ? process.env.SESSION_SECRET_PROD
    : process.env.SESSION_SECRET_DEV;

  if (!secret) {
    throw new Error('OAuth state signing secret is missing.');
  }

  return secret;
}

function createGoogleOAuthState(returnTo) {
  const payload = {
    returnTo: getSafeReturnTo(returnTo),
    nonce: crypto.randomBytes(32).toString('hex'),
    issuedAt: Date.now()
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', getOAuthStateSecret())
    .update(encoded)
    .digest('base64url');

  return {
    state: `${encoded}.${signature}`,
    nonce: payload.nonce
  };
}

function getCookieValue(req, name) {
  const cookies = (req.headers.cookie || '').split(';');

  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');

    if (separator === -1) continue;

    const key = cookie.slice(0, separator).trim();

    if (key === name) {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    }
  }

  return null;
}

function verifyGoogleOAuthState(req, res, next) {
  try {
    const state = req.query.state;
    const cookieNonce = getCookieValue(req, GOOGLE_STATE_COOKIE);

    res.clearCookie(GOOGLE_STATE_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: (process.env.VERCEL_ENV || 'development') === 'production',
      path: '/'
    });

    if (typeof state !== 'string' || !cookieNonce) {
      return res.redirect('/login.html?error=oauth_state');
    }

    const parts = state.split('.');

    if (parts.length !== 2) {
      return res.redirect('/login.html?error=oauth_state');
    }

    const [encoded, suppliedSignature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', getOAuthStateSecret())
      .update(encoded)
      .digest('base64url');

    const suppliedBuffer = Buffer.from(suppliedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      return res.redirect('/login.html?error=oauth_state');
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    );

    const age = Date.now() - payload.issuedAt;

    if (
      !payload.nonce ||
      payload.nonce !== cookieNonce ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > GOOGLE_STATE_MAX_AGE
    ) {
      return res.redirect('/login.html?error=oauth_state');
    }

    req.googleReturnTo = getSafeReturnTo(payload.returnTo);

    next();

  } catch (err) {
    console.error('Google OAuth state validation failed:', err);
    return res.redirect('/login.html?error=oauth_state');
  }
}

// ========================================
// SAFE RETURN DESTINATION
// ========================================
function getSafeReturnTo(value) {
  const fallback = '/homepage.html';

  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return fallback;
  }

  try {
    const url = new URL(value, 'https://velovalue.internal');

    if (url.origin !== 'https://velovalue.internal') {
      return fallback;
    }

    if (/^\/(login|register)\.html$/i.test(url.pathname)) {
      return fallback;
    }

    return url.pathname + url.search + url.hash;

  } catch {
    return fallback;
  }
}


// ========================================
// SERIALIZE USER
// ========================================
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


// ========================================
// GOOGLE STRATEGY
// ========================================
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {

  try {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    const avatar = profile.photos?.[0]?.value;

    if (!email) {
      return done(new Error('Google account did not provide an email.'));
    }

    let user = await User.findOne({
      $or: [
        { googleId: profile.id },
        { email }
      ]
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

      if (!user.avatar && avatar) {
        user.avatar = avatar;
      }

      await user.save();
    }

    return done(null, user);

  } catch (err) {
    return done(err, null);
  }
}));


// ========================================
// FACEBOOK STRATEGY
// ========================================
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL,
  profileFields: ['id', 'displayName', 'photos', 'email']
}, async (accessToken, refreshToken, profile, done) => {

  try {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    const avatar = profile.photos?.[0]?.value;

    let user = await User.findOne({
      $or: [
        { facebookId: profile.id },
        { email }
      ]
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

      if (!user.avatar && avatar) {
        user.avatar = avatar;
      }

      await user.save();
    }

    return done(null, user);

  } catch (err) {
    return done(err, null);
  }
}));


// ========================================
// GOOGLE LOGIN START
// ========================================

router.get('/auth/google', (req, res, next) => {
  try {
    const returnTo = getSafeReturnTo(req.query.returnTo);
    const { state, nonce } = createGoogleOAuthState(returnTo);

    const isProduction =
      (process.env.VERCEL_ENV || 'development') === 'production';

    res.cookie(GOOGLE_STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: GOOGLE_STATE_MAX_AGE,
      path: '/'
    });

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state
    })(req, res, next);

  } catch (err) {
    next(err);
  }
});

// ========================================
// GOOGLE CALLBACK
// ========================================

router.get(
  '/auth/google/callback',

  verifyGoogleOAuthState,

  passport.authenticate('google', {
    failureRedirect: '/login.html'
  }),

  (req, res) => {
    req.session.user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar || null
    };

    const returnTo = getSafeReturnTo(req.googleReturnTo);

    req.session.save((err) => {
      if (err) {
        console.error('Google login session save error:', err);
        return res.status(500).send('Unable to save login session.');
      }

      console.log('Google login successful. Redirecting to:', returnTo);

      res.redirect(returnTo);
    });
  }
);

// ========================================
// FACEBOOK LOGIN START
// ========================================
router.get(
  '/auth/facebook',
  passport.authenticate('facebook', {
    scope: ['email']
  })
);


// ========================================
// FACEBOOK CALLBACK
// ========================================
router.get(
  '/auth/facebook/callback',

  passport.authenticate('facebook', {
    failureRedirect: '/login.html'
  }),

  (req, res) => {

    req.session.user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar || null
    };

    const returnTo = getSafeReturnTo(req.session.authReturnTo);
    delete req.session.authReturnTo;

    req.session.save((err) => {
      if (err) {
        console.error('Facebook login session save error:', err);
        return res.status(500).send('Unable to save login session.');
      }

      res.redirect(returnTo);
    });
  }
);


module.exports = router;
