
const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({
  // Registration plate
  // Not required at schema level to support older vehicle records.
  // The backend add-car route validates new registrations.
  plate: {
    type: String,
    trim: true,
    uppercase: true,
    default: ""
  },

  // Basic vehicle information
  make: {
    type: String,
    default: "Unknown"
  },
  brand: {
    type: String,
    default: "Unknown"
  },
  model: {
    type: String,
    default: "Unknown"
  },
  year: Number,
  fuel: String,

  theftReported: Boolean,

  // Vehicle image and manufacturer logo
  img: String,
  logo: String,

  // Vehicle image attribution
imgSourcePage: String,
imgArtist: String,
imgLicense: String,
imgLicenseUrl: String,

// Manufacturer logo attribution
logoSourcePage: String,
logoArtist: String,
logoLicense: String,
logoLicenseUrl: String,

  // Vehicle identification and technical specifications
  vin: String,
  engine: String,
  transmission: String,
  power: String,
  bodyType: String,

  // Registration and compliance information
  registrationPlace: String,
  euroClass: String,
  insuranceStatus: String,
  inspectionStatus: String,
  inspectionDueDate: String
});

const garageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  vehicles: [vehicleSchema]
});

module.exports = mongoose.model("Garage", garageSchema);
