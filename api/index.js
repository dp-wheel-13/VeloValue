const cors = require('cors');
const path = require("path");

// Load .env from the project root (one level up from /api)
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const axios = require("axios");

// Import your models and routes
const User = require("../models/User");
const garageRoutes = require("../routes/garageRoutes");
const infotargaRoutes = require("../routes/infotarga"); // InfoTarga routes

const app = express();

// ------------------- MIDDLEWARE -------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "../public")));

// Session (in-memory, replace with Redis or DB in production)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "velovalue_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // set to true if using HTTPS
  })
);

// ------------------- ROUTES -------------------
// InfoTarga routes -> /api/infotarga/:plate  and /api/lookup/:plate
app.use("/api", infotargaRoutes);

// Your existing garage routes
app.use("/", garageRoutes);

// ------------------- MONGO CONNECTION -------------------
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.warn("⚠️  MONGO_URI is not set in .env — skipping MongoDB connection.");
} else if (!mongoose.connection.readyState) {
  mongoose
    .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));
}

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

// ------------------- AUTH ROUTES -------------------

// Signup
app.post("/signup", async (req, res) => {
  try {
    const { fullname, email, password, confirmPassword } = req.body;
    if (!fullname || !email || !password || !confirmPassword)
      return res.json({ success: false, message: "All fields are required" });
    if (password !== confirmPassword)
      return res.json({ success: false, message: "Passwords do not match" });

    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser)
      return res.json({ success: false, message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      fullName: fullname,
      email: email.trim().toLowerCase(),
      password: hashedPassword
    });
    await newUser.save();

    req.session.userId = newUser._id;
    req.session.username = newUser.fullName;
    res.json({ success: true, username: newUser.fullName });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error registering user" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.json({ success: false, message: "Email and password required" });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: "Incorrect password" });

    req.session.userId = user._id;
    req.session.username = user.fullName;
    res.json({ success: true, username: user.fullName });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error logging in" });
  }
});

// Session info
app.get("/api/user", (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
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

// ------------------- CHARGING STATIONS -------------------
const stations = [
  { id: 1, name: "Station A", lat: 37.7749, lng: -122.4194 },
  { id: 2, name: "Station B", lat: 37.7849, lng: -122.4094 },
  { id: 3, name: "Station C", lat: 37.7949, lng: -122.4294 }
];
app.get("/api/stations", (req, res) => res.json(stations));

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});