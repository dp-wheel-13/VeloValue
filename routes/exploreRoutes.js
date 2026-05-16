// /routes/exploreRoutes.js
const express = require("express");
const router = express.Router();
const CarCache = require("../models/CarCache");
const { getCarData } = require("../services/WikiCarService");

// ------------------------------------------------------------
// 1️⃣ GET ALL CACHED CARS (this must be OUTSIDE /explore route)
// ------------------------------------------------------------
router.get("/cachedCars", async (req, res) => {
  try {
    const cars = await CarCache.find({});
    const allCars = cars.map(c => c.data); // return only car data
    res.json(allCars);
  } catch (err) {
    console.error("Failed to fetch cached cars", err);
    res.status(500).json({ error: "Failed to fetch cached cars" });
  }
});

// ------------------------------------------------------------
// 2️⃣ EXPLORE ROUTE - SEARCH FOR A CAR
// ------------------------------------------------------------
// GET /api/explore?brand=Toyota&model=Corolla&year=2020
router.get("/explore", async (req, res) => {
  try {
    const { brand, model, year } = req.query;

    if (!brand || !model)
      return res.status(400).json({ error: "brand and model are required" });

    // ----------------- Check cache first -----------------
    const cacheQuery = {
      brand: brand.toLowerCase(),
      model: model.toLowerCase(),
      ...(year ? { year } : {}),
    };

    const cached = await CarCache.findOne(cacheQuery);

    if (cached) {
      console.log("🚀 Returning cached data");
      return res.json(cached.data);
    }

    // ----------------- Fetch fresh data -----------------
    const carData = await getCarData({ brand, model, year });

    // ----------------- Save to cache -----------------
    await CarCache.create({
      brand: brand.toLowerCase(),
      model: model.toLowerCase(),
      year: year || null,
      data: carData,
    });

    console.log("✅ Car data cached");

    res.json(carData);
  } catch (err) {
    console.error("Explore API error:", err);
    res.status(500).json({ error: "Failed to fetch explore data" });
  }
});

module.exports = router;
