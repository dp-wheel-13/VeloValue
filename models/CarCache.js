
const mongoose = require("mongoose");

const carCacheSchema = new mongoose.Schema({
  // Legacy fields — retained for backward compatibility
  brand: { type: String, default: null },
  model: { type: String, default: null },
  year: { type: String, default: null },

  // New CarVariables cache fields
  cacheKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  source: {
    type: String,
    default: "legacy"
  },
  type: {
    type: String,
    enum: ["legacy", "search", "browse", "generation"],
    default: "legacy"
  },

  // Complete API response
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Only CarVariables cache records receive an expiry date
  expiresAt: {
    type: Date,
    default: null
  }
});

// Expire records when their explicit expiry date is reached
carCacheSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);
module.exports = mongoose.model("CarCache", carCacheSchema);
