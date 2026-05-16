const mongoose = require("mongoose");

const carCacheSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String },
  year: { type: String },
  data: { type: Object, required: true }, // stores merged API data
  updatedAt: { type: Date, default: Date.now }
});

// TTL index (optional) — cache expires in 24h
carCacheSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("CarCache", carCacheSchema);
