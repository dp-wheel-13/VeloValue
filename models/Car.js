const mongoose = require("mongoose");

const carSchema = new mongoose.Schema({
  brand: String,
  model: String,
  plate: String,
  fuel: String,
  img: String,
  logo: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
});

module.exports = mongoose.model("Car", carSchema);
