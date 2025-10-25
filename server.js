// ------------------- ENV CONFIG -------------------
require('dotenv').config();
console.log("✅ Your DeepL key loaded:", process.env.DEEPL_API_KEY ? "Yes" : "No");

// ------------------- IMPORTS -------------------
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const axios = require("axios"); // For DeepL API
const User = require("./models/User");
const garageRoutes = require("./routes/garageRoutes");
const app = express();

// ------------------- MIDDLEWARE -------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "velovalue_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);
app.use("/", garageRoutes);

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

// ------------------- TRANSLATION ROUTE -------------------
app.post("/api/translate", async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    console.log("🧠 Translation request received:", text, targetLang);

    if (!text || !targetLang) {
      return res.status(400).json({ error: "Missing text or target language" });
    }

    // Step 1: Check cache
    const cached = await Translation.findOne({ text, targetLang });
    if (cached) {
      console.log("✅ Translation served from MongoDB cache");
      return res.json({ translatedText: cached.translatedText, source: "cache" });
    }

    // Step 2: Fetch from DeepL
    const deeplRes = await axios.post(
      "https://api-free.deepl.com/v2/translate",
      new URLSearchParams({
        auth_key: process.env.DEEPL_API_KEY,
        text,
        target_lang: targetLang.toUpperCase(),
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const translatedText = deeplRes.data.translations[0].text;

    // Step 3: Save in Mongo
    await Translation.create({ text, targetLang, translatedText });

    console.log("🌐 Translation fetched from DeepL and saved to DB");
    res.json({ translatedText, source: "deepl" });
  } catch (error) {
    console.error("❌ Translation Error:", error.message);
    res.status(500).json({ error: "Translation failed" });
  }
});

// ------------------- STATIC ROUTES -------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/homepage.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "homepage.html"));
});

// ------------------- AUTH ROUTES -------------------
app.post("/signup", async (req, res) => {
  try {
    const { fullname, email, password, confirmPassword } = req.body;

    if (!fullname || !email || !password || !confirmPassword) {
      return res.json({ success: false, message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.json({ success: false, message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({
      email: email.trim().toLowerCase(),
    });
    if (existingUser) {
      return res.json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      fullName: fullname,
      email: email.trim().toLowerCase(),
      password: hashedPassword,
    });

    await newUser.save();
    req.session.userId = newUser._id;
    req.session.username = newUser.fullName;

    res.json({ success: true, username: newUser.fullName });
  } catch (err) {
    console.error("Signup Error:", err);
    res.json({ success: false, message: "Error registering user" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.json({ success: false, message: "Email and password required" });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user)
      return res.json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.json({ success: false, message: "Incorrect password" });

    req.session.userId = user._id;
    req.session.username = user.fullName;

    res.json({ success: true, username: user.fullName });
  } catch (err) {
    console.error("Login Error:", err);
    res.json({ success: false, message: "Error logging in" });
  }
});

// ------------------- SESSION ROUTES -------------------
app.get("/api/user", (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
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

app.get("/api/stations", (req, res) => {
  res.json(stations);
});

// ------------------- START SERVER -------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
