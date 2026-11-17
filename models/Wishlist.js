const mongoose = require("mongoose");

const wishlistCarSchema = new mongoose.Schema({
  carId: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    default: ""
  },
  brand: {
    type: String,
    required: true
  },
  model: {
    type: String,
    required: true
  },
  generation: {
    type: String,
    default: ""
  },
  body: {
    type: String,
    default: ""
  },
  price: {
    type: Number,
    default: null
  },
  img: {
    type: String,
    default: ""
  },
  fuels: {
    type: [String],
    default: []
  },
  transmission: {
    type: String,
    default: ""
  },
  year_start: {
    type: Number,
    default: null
  },
  year_end: {
    type: Number,
    default: null
  }
}, { _id: false });

const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true
  },
  cars: {
    type: [wishlistCarSchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Wishlist", wishlistSchema);
