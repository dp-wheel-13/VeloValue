// ------------------- ENV CONFIG -------------------
require('dotenv').config();

// ------------------- DEBUG ENV -------------------
console.log("✅ DeepL Key loaded:", process.env.DEEPL_API_KEY ? "Yes" : "No");
console.log("✅ API Ninja Key loaded:", process.env.API_NINJA_KEY ? "Yes" : "No");
console.log("✅ SESSION_SECRET loaded:", process.env.SESSION_SECRET ? "Yes" : "No");

// ------------------- IMPORTS -------------------
const passport = require('passport');
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const cors = require('cors'); 
const User = require("./models/User");
const garageRoutes = require("./routes/garageRoutes");
const exploreRoutes = require("./routes/exploreRoutes");
const infotargaRoutes = require("./routes/infotarga");
const app = express();

// ------------------- MIDDLEWARE -------------------
app.use(cors()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // set true if using HTTPS
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// ------------------- ROUTES -------------------
app.use(passport.initialize());
app.use(passport.session());
app.use('/', require('./routes/authSocial'));
app.use('/', require('./routes/authGoogle'));
app.use("/", garageRoutes); 
app.use("/api", require("./routes/exploreRoutes")); // Explore Cars uses /api/explore

app.use("/api", infotargaRoutes); // InfoTarga routes

// ------------------- MONGO CONNECTION -------------------
const MONGO_URI =
  "mongodb+srv://velovalue:ob4PrtoHdmFj8zA6@velovalue-cluster.ycpmqjy.mongodb.net/velovalue_test?retryWrites=true&w=majority";

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ------------------- TRANSLATION MODEL -------------------
const translationSchema = new mongoose.Schema({
  text: String,
  targetLang: String,
  translatedText: String,
});
const Translation = mongoose.model("Translation", translationSchema);

// ------------------- IN-MEMORY TRANSLATION CACHE -------------------
const translationCache = new Map();

// ------------------- TRANSLATION FUNCTION -------------------
const axios = require("axios");

async function translateBatch(texts, targetLang) {
  const results = {};

  for (const text of texts) {
    const key = `${text}|${targetLang}`;

    if (translationCache.has(key)) {
      results[text] = translationCache.get(key);
      continue;
    }

    const cached = await Translation.findOne({ text, targetLang });
    if (cached) {
      translationCache.set(key, cached.translatedText);
      results[text] = cached.translatedText;
      continue;
    }

    if (!process.env.DEEPL_API_KEY)
      throw new Error("Missing DEEPL_API_KEY in .env");

    const params = new URLSearchParams();
    params.append("text", text);
    params.append("target_lang", targetLang.toUpperCase());

    const deeplRes = await axios.post(
      "https://api-free.deepl.com/v2/translate",
      params,
      {
        headers: {
          Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const translated = deeplRes.data.translations[0].text;

    translationCache.set(key, translated);

    await Translation.create({ text, targetLang, translatedText: translated });

    results[text] = translated;
  }

  return results;
}

// ------------------- TRANSLATION ROUTE -------------------
app.post("/api/translate", async (req, res) => {
  try {
    const { texts, targetLang } = req.body;

    if (!texts || !Array.isArray(texts) || !targetLang) {
      return res
        .status(400)
        .json({ error: "Missing texts array or targetLang" });
    }

    const translations = await translateBatch(texts, targetLang);
    res.json({ translations });
  } catch (err) {
    console.error("❌ Translation error:", err.message);
    res.status(500).json({ error: "Translation failed" });
  }
});

// ------------------- AUTH ROUTES -------------------

// Signup
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.json({ loggedIn: false, error: "All fields are required" });

    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser)
      return res.json({ loggedIn: false, error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
    });

    req.session.userId = newUser._id;
    req.session.user = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      avatar: null
    };

    res.json({
  loggedIn: true,
  user: req.session.user,
  avatar: req.session.user.avatar   // ✅ SEND IMAGE TO FRONTEND
});
  } catch (err) {
    console.error("❌ Register Error:", err);
    res.json({ loggedIn: false, error: "Error registering user" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.json({ loggedIn: false, error: "Email and password required" });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.json({ loggedIn: false, error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ loggedIn: false, error: "Incorrect password" });

    req.session.userId = user._id;
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: null
    };

    res.json({
  loggedIn: true,
  user: req.session.user,
  avatar: req.session.user.avatar   // ✅ SEND IMAGE TO FRONTEND
});

  } catch (err) {
    console.error("❌ Login Error:", err);
    res.json({ loggedIn: false, error: "Error logging in" });
  }
});

// Logout
app.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("❌ Logout Error:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ loggedIn: false });
  });
});

// Get current user
app.get("/api/user", (req, res) => {
  if (req.session.user) {
    res.json({
  loggedIn: true,
  user: req.session.user,
  avatar: req.session.user.avatar   // ✅ SEND IMAGE TO FRONTEND
});

  } else {
    res.json({ loggedIn: false });
  }
});

// ------------------- GLOBAL ERROR HANDLER -------------------
app.use((err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

// ------------------- START SERVER -------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at port ${PORT}`);
});
