const express = require("express");
const router = express.Router();
const Wishlist = require("../models/Wishlist");

// Require an authenticated session
function requireAuth(req, res, next) {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({
      success: false,
      message: "Not logged in"
    });
  }

  next();
}

// GET: Retrieve the current user's Wishlist
router.get("/api/wishlist", requireAuth, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      userId: req.session.user.id
    }).lean();

    return res.json({
      success: true,
      cars: wishlist?.cars || []
    });
  } catch (err) {
    console.error("Wishlist retrieval failed:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve Wishlist"
    });
  }
});

// POST: Add a car to the current user's Wishlist
router.post("/api/wishlist", requireAuth, async (req, res) => {
  try {
    const {
      carId,
      code,
      brand,
      model,
      generation,
      body,
      price,
      img,
      fuels,
      transmission,
      year_start,
      year_end
    } = req.body;

    if (
      typeof carId !== "string" || !carId.trim() ||
      typeof brand !== "string" || !brand.trim() ||
      typeof model !== "string" || !model.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid car ID, brand and model are required"
      });
    }

    const car = {
      carId: carId.trim(),
      code: typeof code === "string" ? code : "",
      brand: brand.trim(),
      model: model.trim(),
      generation: typeof generation === "string" ? generation : "",
      body: typeof body === "string" ? body : "",
      price: Number.isFinite(Number(price)) && price !== null && price !== ""
        ? Number(price)
        : null,
      img: typeof img === "string" ? img : "",
      fuels: Array.isArray(fuels)
        ? fuels.filter(fuel => typeof fuel === "string")
        : [],
      transmission: typeof transmission === "string" ? transmission : "",
      year_start: Number.isFinite(Number(year_start)) && year_start !== null && year_start !== ""
        ? Number(year_start)
        : null,
      year_end: Number.isFinite(Number(year_end)) && year_end !== null && year_end !== ""
        ? Number(year_end)
        : null
    };

    // Ensure the user's Wishlist document exists before adding a car.
    await Wishlist.findOneAndUpdate(
      { userId: req.session.user.id },
      { $setOnInsert: { userId: req.session.user.id } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    // Prevent duplicate cars from being added.
    await Wishlist.updateOne(
      {
        userId: req.session.user.id,
        "cars.carId": { $ne: car.carId }
      },
      {
        $push: { cars: car }
      },
      { runValidators: true }
    );

    const wishlist = await Wishlist.findOne({
      userId: req.session.user.id
    }).lean();

    return res.json({
      success: true,
      message: "Car added to Wishlist",
      cars: wishlist.cars
    });
  } catch (err) {
    console.error("Wishlist add failed:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to add car to Wishlist"
    });
  }
});

// DELETE: Remove one car from the current user's Wishlist
router.delete("/api/wishlist/:carId", requireAuth, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      { userId: req.session.user.id },
      { $pull: { cars: { carId: req.params.carId } } },
      { new: true }
    );

    return res.json({
      success: true,
      cars: wishlist?.cars || []
    });
  } catch (err) {
    console.error("Wishlist removal failed:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to remove car from Wishlist"
    });
  }
});

// DELETE: Clear the current user's Wishlist
router.delete("/api/wishlist", requireAuth, async (req, res) => {
  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      { userId: req.session.user.id },
      { $set: { cars: [] } },
      { new: true }
    );

    return res.json({
      success: true,
      cars: wishlist?.cars || []
    });
  } catch (err) {
    console.error("Wishlist clear failed:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to clear Wishlist"
    });
  }
});

module.exports = router;
