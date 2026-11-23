const mongoose = require("mongoose");

const carPriceSchema = new mongoose.Schema({
  make: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  generation: {
    type: String,
    default: null,
    trim: true
  },
  modelYear: {
    type: Number,
    default: null
  },
  startingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: "EUR"
  },
  market: {
    type: String,
    default: "IT"
  },
  priceType: {
    type: String,
    enum: ["list", "promotional"],
    default: "list"
  },
  ivaIncluded: {
    type: Boolean,
    default: false
  },
  sourceUrl: {
    type: String,
    default: null
  },
  sourceTitle: {
    type: String,
    default: null
  },
  sourceEvidence: {
    type: String,
    default: null
  },
  validFrom: {
    type: Date,
    default: null
  },
  validUntil: {
    type: Date,
    default: null
  },
  verified: {
    type: Boolean,
    default: false
  },
  lastCheckedAt: {
    type: Date,
    default: null
  },
  lastAttemptAt: {
    type: Date,
    default: null
  },
  nextCheckAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

carPriceSchema.index(
  { make: 1, model: 1, generation: 1, modelYear: 1, market: 1 },
  { unique: true }
);

module.exports = mongoose.model("CarPrice", carPriceSchema);
