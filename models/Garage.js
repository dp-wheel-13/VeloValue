// models/Garage.js
const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({
  make: String,
  model: String,
  year: Number,
});

const garageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  vehicles: [vehicleSchema],
});

module.exports = mongoose.model("Garage", garageSchema);