// routes/garageRoutes.js
const express = require("express");
const router = express.Router();
const Garage = require("../models/Garage");

// Middleware: require login
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login.html");
  }
  next();
}

// ------------------- ROUTE 1: SmartGarage Entry -------------------
// Decides whether to go to garagesearch (Page X) or garageview (Page Y)
router.get("/garage-entry", requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId;  
    const garage = await Garage.findOne({ userId });

    if (!garage || !garage.vehicles || garage.vehicles.length === 0) {
      // New user / no vehicles → Page X
      return res.redirect("/Explore smart garage beta/garagesearch.html");
    } else {
      // At least 1 vehicle → Page Y
      return res.redirect("/Explore smart garage beta/garageview.html");
    }
  } catch (err) {
    console.error("Garage check failed:", err);
    return res.redirect("/login.html");
  }
});

// ------------------- ROUTE 2: Search & Add Car -------------------
// Called from garagesearch.html "Proceed" button
router.post("/garage/search", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: "Not logged in" });
    }

    const { plate } = req.body;
    if (!plate) {
      return res.json({ success: false, message: "Plate number required" });
    }

    // Step 1: Lookup car details
    // For demo: hardcode "ABC123" as a found car
    let carDetails;
    if (plate === "ABC123") {
      carDetails = {
        plate,
        make: "Tesla",
        model: "Model 3",
        year: 2022
      };
    }

    if (!carDetails) {
      // No car found
      return res.json({ success: false }); // frontend will show error text
    }

    // Step 2: Save into current user's garage
    let garage = await Garage.findOne({ userId: req.session.userId });
    if (!garage) {
      garage = new Garage({ userId: req.session.userId, vehicles: [] });
    }

    garage.vehicles.push(carDetails);
    await garage.save();

    res.json({ success: true }); // frontend will redirect on success
  } catch (err) {
    console.error("Error in /garage/search:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;