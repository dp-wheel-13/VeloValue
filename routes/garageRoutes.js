// routes/garageRoutes.js
const express = require("express");
const router = express.Router();
const Garage = require("../models/Garage");

// ------------------- ROUTE 1: SmartGarage Entry -------------------
router.get("/garage-entry", async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.json({ status: "NOT_AUTHENTICATED" });
    }

    const userId = req.session.user.id;
    const garage = await Garage.findOne({ userId });

    if (!garage || !garage.vehicles || garage.vehicles.length === 0) {
      return res.json({ status: "NO_CAR" });
    } else {
      return res.json({ status: "HAS_CAR" });
    }
  } catch (err) {
    console.error("Garage check failed:", err);
    return res.json({ status: "NOT_AUTHENTICATED" });
  }
});

// ------------------- ROUTE 2: Search & Add Car -------------------
router.post("/garage/search", async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ success: false, message: "Not logged in" });
    }

    const userId = req.session.user.id;
    const { plate, brand, model, fuel, year, img, logo } = req.body;

    if (!plate) {
      return res.status(400).json({ success: false, message: "Plate number required" });
    }

    // Normalize plate (remove spaces/dashes for consistent checking)
    const normalizedPlate = plate.replace(/[\s-]/g, "").toUpperCase();

    let garage = await Garage.findOne({ userId });
    if (!garage) {
      garage = new Garage({ userId, vehicles: [] });
    }

    // Prevent duplicates
    const alreadyExists = garage.vehicles.some(v => v.plate === normalizedPlate);
    if (alreadyExists) {
      return res.json({ success: true, message: "Car already in garage" });
    }

    // Safely build the car object
    // We send BOTH 'make' and 'brand' so it works regardless of your MongoDB schema setup
    const carDetails = {
      plate: normalizedPlate,
      make: brand || "Unknown",     // For MongoDB schema expecting 'make'
      brand: brand || "Unknown",    // For MongoDB schema expecting 'brand'
      model: model || "Unknown"
    };

    // Only add optional fields if they exist AND are valid
    if (year && !isNaN(Number(year))) carDetails.year = Number(year);
    if (fuel) carDetails.fuel = fuel;
    if (img) carDetails.img = img;
    if (logo) carDetails.logo = logo;

    garage.vehicles.push(carDetails);
    await garage.save();

    res.json({ success: true, message: "Car added successfully" });
  } catch (err) {
    console.error("Error in /garage/search:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ------------------- ROUTE 3: Get User Status -------------------
router.get("/api/user-status", (req, res) => {
  if (req.session.user && req.session.user.id) {
    res.json({
      loggedIn: true,
      user: {
        id: req.session.user.id,
        name: req.session.user.name,
        email: req.session.user.email
      }
    });
  } else {
    res.json({ loggedIn: false, user: null });
  }
});

// ------------------- ROUTE 4: Remove Car -------------------
router.post("/garage/remove-car", async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ success: false, message: "Not logged in" });
    }

    const userId = req.session.user.id;
    const { plate } = req.body;

    // If frontend sends a blank plate, force remove the first car in the array (cleanup for old broken data)
    if (!plate) {
      const garage = await Garage.findOne({ userId });
      if (garage && garage.vehicles.length > 0) {
        garage.vehicles.shift(); // Remove the first item
        await garage.save();
        return res.json({ success: true, message: "Ghost car removed" });
      }
      return res.status(400).json({ success: false, message: "Plate required" });
    }

    const garage = await Garage.findOne({ userId });
    if (!garage) {
      return res.json({ success: false, message: "Garage not found" });
    }

    // Filter out the car with the matching plate
    garage.vehicles = garage.vehicles.filter(v => v.plate !== plate);
    await garage.save();

    res.json({ success: true, message: "Car removed successfully" });
  } catch (err) {
    console.error("Error removing car:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ------------------- ROUTE 5: Get User's Vehicles -------------------
router.get("/api/garage/vehicles", async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ success: false, message: "Not logged in" });
    }

    const userId = req.session.user.id;
    const garage = await Garage.findOne({ userId });

    if (!garage || !garage.vehicles) {
      return res.json({ success: true, vehicles: [] });
    }

    res.json({ success: true, vehicles: garage.vehicles });
  } catch (err) {
    console.error("Error fetching vehicles:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;