const express = require("express");
const serverless = require("serverless-http");
const path = require("path");
const session = require("express-session");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const User = require("../models/User");
const garageRoutes = require("../routes/garageRoutes");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

app.use(session({
  secret: "velovalue_secret_key",
  resave: false,
  saveUninitialized: true,
}));

app.use("/", garageRoutes);

// Example API route
app.get("/api/test", (req, res) => {
  res.json({ message: "Serverless API is working!" });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

module.exports.handler = serverless(app);
