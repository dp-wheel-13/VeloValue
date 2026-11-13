const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const path = require("path");

// Load .env from the project root (one level up from /api)
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const axios = require("axios");
const VERCEL_ENV = process.env.VERCEL_ENV || "development";
if (!["development", "preview", "production"].includes(VERCEL_ENV)) {
  throw new Error("Invalid VERCEL_ENV: " + VERCEL_ENV);
}
const IS_PRODUCTION = VERCEL_ENV === "production";
const MONGO_URI = IS_PRODUCTION
  ? process.env.MONGO_URI_PROD
  : process.env.MONGO_URI_DEV;
const passport = require("passport");

if (!MONGO_URI) {
  throw new Error(`Missing MongoDB URI for ${VERCEL_ENV}`);
}

const SESSION_SECRET = IS_PRODUCTION
  ? process.env.SESSION_SECRET_PROD
  : process.env.SESSION_SECRET_DEV;

if (!SESSION_SECRET) {
  throw new Error(`Missing session secret for ${VERCEL_ENV}`);
}

// Import your models and routes
const User = require("../models/User");
const garageRoutes = require("../routes/garageRoutes");
const exploreRoutes = require("../routes/exploreRoutes");
const infotargaRoutes = require("../routes/infotarga"); // InfoTarga routes
const authSocialRoutes = require("../routes/authSocial");
const app = express();

// ------------------- MIDDLEWARE -------------------
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "../public")));

// Persistent MongoDB sessions
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MONGO_URI
      ? MongoStore.create({
          mongoUrl: MONGO_URI,
          collectionName: "sessions",
          ttl: 14 * 24 * 60 * 60
        })
      : undefined,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PRODUCTION,
      maxAge: 14 * 24 * 60 * 60 * 1000
    }
  })
);

// Passport authentication
app.use(passport.initialize());
app.use(passport.session());

// ------------------- ROUTES -------------------
// InfoTarga routes -> /api/infotarga/:plate  and /api/lookup/:plate
app.use("/api", infotargaRoutes);

// Your existing garage routes
app.use("/", garageRoutes);
app.use("/api", exploreRoutes);

// Google and Facebook authentication
app.use("/", authSocialRoutes);

// ------------------- MONGO CONNECTION -------------------

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected:", mongoose.connection.name))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// ------------------- MODELS -------------------
// Translation cache model (used in your existing translation route)
const translationSchema = new mongoose.Schema({
  text: String,
  targetLang: String,
  translatedText: String
});
const Translation = mongoose.model("Translation", translationSchema);

// ------------------- API ROUTES -------------------

// Translation route
app.post("/api/translate", async (req, res) => {
  try {
    const { texts, targetLang } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: "Missing texts array" });
    }

    const translations = {};

    for (const text of texts) {
      const cached = await Translation.findOne({ text, targetLang });
      if (cached) {
        translations[text] = cached.translatedText;
        continue;
      }

      const deeplRes = await axios.post(
        "https://api-free.deepl.com/v2/translate",
        new URLSearchParams({
          auth_key: process.env.DEEPL_API_KEY,
          text,
          target_lang: targetLang.toUpperCase()
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const translatedText = deeplRes.data.translations[0].text;
      translations[text] = translatedText;

      await Translation.create({ text, targetLang, translatedText });
    }

    return res.json({ translations });
  } catch (err) {
    console.error("Translation error:", err);
    res.status(500).json({ translations: {} });
  }
});

// Authentication rate limits
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { loggedIn: false, error: "Too many login attempts. Please try again later." }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { loggedIn: false, error: "Too many registration attempts. Please try again later." }
});
// ------------------- AUTH ROUTES -------------------

// Registration (supports both current frontend and legacy signup route)
app.post(["/register", "/signup"], registerLimiter, async (req, res) => {
  try {
    const { name, fullname, email, password, confirmPassword } = req.body;

    const userName = (name || fullname || "").trim();

    if (!userName || !email || !password) {
      return res.json({
        loggedIn: false,
        error: "All fields are required"
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.json({
        loggedIn: false,
        error: "Passwords do not match"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.json({
        loggedIn: false,
        error: "Email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: userName,
      email: normalizedEmail,
      password: hashedPassword
    });

    req.session.userId = newUser._id;
    req.session.user = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      avatar: null
    };

    req.session.save((err) => {
      if (err) {
        console.error("Registration session save error:", err);
        return res.status(500).json({
          loggedIn: false,
          error: "Unable to create session"
        });
      }

      return res.json({
        loggedIn: true,
        user: req.session.user,
        avatar: req.session.user.avatar
      });
    });

  } catch (err) {
    console.error("Registration error:", err);

    return res.status(500).json({
      loggedIn: false,
      error: "Error registering user"
    });
  }
});

// Login
app.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({
        loggedIn: false,
        error: "Email and password required"
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user || !user.password) {
      return res.json({
        loggedIn: false,
        error: "User not found or password login unavailable"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({
        loggedIn: false,
        error: "Incorrect password"
      });
    }

    req.session.userId = user._id;
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || null
    };

    req.session.save((err) => {
      if (err) {
        console.error("Login session save error:", err);

        return res.status(500).json({
          loggedIn: false,
          error: "Unable to create session"
        });
      }

      return res.json({
        loggedIn: true,
        user: req.session.user,
        avatar: req.session.user.avatar
      });
    });

  } catch (err) {
    console.error("Login error:", err);

    return res.status(500).json({
      loggedIn: false,
      error: "Error logging in"
    });
  }
});

// Session info
app.get("/api/user", (req, res) => {
  // FIX 3: Match the standardized session object
  if (req.session.user && req.session.user.id) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false, user: null });
  }
});

// Logout
app.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.json({ success: false, message: "Logout failed" });
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

// ------------------- VELOCHARGE: PUBLIC CONFIG -------------------
app.get("/api/config", (req, res) => {
  const mapboxToken = process.env.MAPBOX_PUBLIC_TOKEN?.trim();

  if (!mapboxToken) {
    return res.status(500).json({
      error: "Mapbox public token is not configured."
    });
  }

  res.set("Cache-Control", "no-store");
  return res.json({ mapboxToken });
});

app.get("/api/config.js", (req, res) => {
  const mapboxToken = process.env.MAPBOX_PUBLIC_TOKEN?.trim();

  if (!mapboxToken) {
    return res.status(500).send(
      "console.error('Mapbox public token is not configured.');"
    );
  }

  res.set("Content-Type", "application/javascript; charset=utf-8");
  res.set("Cache-Control", "no-store");

  return res.send(
    `window.VELOCHARGE_CONFIG = ${JSON.stringify({
      mapboxToken
    })};`
  );
});

// ------------------- VELOCHARGE: CHARGING STATIONS -------------------
app.get("/api/charging-stations", async (req, res) => {
  try {
    const apiKey = process.env.OCM_API_KEY?.trim();

    if (!apiKey) {
      return res.status(500).json({
        error: "Open Charge Map API key is not configured."
      });
    }

    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const distance = Number(req.query.distance ?? 10);
    const maxResults = Number(req.query.maxresults ?? 200);

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(distance) ||
      distance < 1 ||
      distance > 25 ||
      !Number.isInteger(maxResults) ||
      maxResults < 1 ||
      maxResults > 500
    ) {
      return res.status(400).json({
        error: "Invalid location or station search parameters."
      });
    }

    const response = await axios.get(
      "https://api.openchargemap.io/v3/poi/",
      {
        params: {
          output: "json",
          latitude,
          longitude,
          distance,
          distanceunit: "KM",
          maxresults: maxResults,
          compact: "true",
          verbose: "false",
          key: apiKey
        },
        timeout: 15000
      }
    );

    if (!Array.isArray(response.data)) {
      throw new Error("Invalid response from Open Charge Map.");
    }

    return res.json(response.data);

  } catch (err) {
    console.error("VeloCharge upstream error:", {
  status: err.response?.status,
  data: err.response?.data,
  message: err.message
});

    return res.status(502).json({
      error: "Unable to retrieve charging stations."
    });
  }
});

// ------------------- STATIC ROUTES -------------------
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/homepage.html"))
);
app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/login.html"))
);
app.get("/homepage.html", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/homepage.html"))
);

// ------------------- EXPORT APP & START SERVER -------------------
module.exports = app;

// Start local server only when running this file directly.
// Vercel imports the exported app without calling app.listen().
if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
