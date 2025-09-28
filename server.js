const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const User = require("./models/User");
const app = express();
const garageRoutes = require("./routes/garageRoutes");

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

// ------------------- ROUTES -------------------

// Serve Register Page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

// Serve Login Page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Serve Homepage
app.get("/homepage.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "homepage.html"));
});

// ------------------- AUTH ROUTES -------------------

// Signup Route
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

    // Set session
    req.session.userId = newUser._id;
    req.session.username = newUser.fullName;

    // ✅ send success back, frontend will redirect
    return res.json({ success: true, username: newUser.fullName });
  } catch (err) {
    console.error("Signup Error:", err);
    return res.json({ success: false, message: "Error registering user" });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({
        success: false,
        message: "Email and password required",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Incorrect password" });
    }

    // Set session
    req.session.userId = user._id;
    req.session.username = user.fullName;

    // ✅ send success back, frontend will redirect
    return res.json({ success: true, username: user.fullName });
  } catch (err) {
    console.error("Login Error:", err);
    return res.json({ success: false, message: "Error logging in" });
  }
});

// ------------------- SESSION ROUTES -------------------

// Get current logged-in user
app.get("/api/user", (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

// Logout
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.json({ success: false, message: "Logout failed" });
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

// ------------------- START SERVER -------------------

const PORT = 3000;

// 👉 mount garage routes BEFORE listen
app.use("/", garageRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// Temporary static charging stations (later from MongoDB)
const stations = [
  { id: 1, name: "Station A", lat: 37.7749, lng: -122.4194 },
  { id: 2, name: "Station B", lat: 37.7849, lng: -122.4094 },
  { id: 3, name: "Station C", lat: 37.7949, lng: -122.4294 }
];

app.get("/api/stations", (req, res) => {
  res.json(stations);
});
