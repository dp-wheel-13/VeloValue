
const express = require("express");
const router = express.Router();

const CarCache = require("../models/CarCache");
const { getCarData } = require("../services/WikiCarService");
const {
  searchCars,
  getCars
} = require("../services/CarVariablesService");

const CACHE_SOURCE = "carvariables";

// ------------------------------------------------------------
// CACHE HELPERS
// ------------------------------------------------------------

function normalizeValue(value) {
  return String(value).trim().toLowerCase();
}

function buildCacheKey(type, params) {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result, key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
        result[key] = params[key];
      }
      return result;
    }, {});

  return `${CACHE_SOURCE}:${type}:${JSON.stringify(sortedParams)}`;
}

async function getCachedResponse(cacheKey) {
  const cached = await CarCache.findOne({
    cacheKey,
    source: CACHE_SOURCE,
    expiresAt: { $gt: new Date() }
  }).lean();

  if (cached) {
    console.log("[Explore Cache] HIT:", cacheKey);
    return cached.data;
  }

  console.log("[Explore Cache] MISS:", cacheKey);
  return null;
}

async function saveCachedResponse({ cacheKey, type, data }) {
  await CarCache.findOneAndUpdate(
    { cacheKey },
    {
      $set: {
        cacheKey,
        source: CACHE_SOURCE,
        type,
        data,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000)
      },
      $setOnInsert: {
        brand: null,
        model: null,
        year: null
      }
    },
    {
      upsert: true,
      new: true,
      runValidators: true
    }
  );
}

// ------------------------------------------------------------
// 1. SEARCH VEHICLES
// GET /api/explore/search?q=BMW%20M3%202008
// ------------------------------------------------------------

router.get("/explore/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "A vehicle search query is required."
      });
    }

    if (query.length > 200) {
      return res.status(400).json({
        success: false,
        error: "Search query must not exceed 200 characters."
      });
    }

    const page = Number(req.query.page || 1);
    const per = Number(req.query.per || 20);

    if (!Number.isInteger(page) || page < 1 ||
        !Number.isInteger(per) || per < 1 || per > 50) {
      return res.status(400).json({
        success: false,
        error: "Invalid pagination parameters."
      });
    }

    const params = {
      q: normalizeValue(query),
      page,
      per,
      variants: true
    };

    const cacheKey = buildCacheKey("search", params);
    const cached = await getCachedResponse(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const result = await searchCars({
      query,
      page,
      per,
      includeVariants: true
    });

    await saveCachedResponse({
      cacheKey,
      type: "search",
      data: result
    });

    return res.json(result);

  } catch (error) {
    console.error("CarVariables search route error:", error.message);

    return res.status(502).json({
      success: false,
      error: error.message || "Vehicle search failed."
    });
  }
});

// ------------------------------------------------------------
// 2. BROWSE VEHICLES
// GET /api/explore/cars?make=BMW&modelYear=2008
// ------------------------------------------------------------

router.get("/explore/cars", async (req, res) => {
  try {
    const allowedFilters = [
      "make",
      "modelFamily",
      "modelYear",
      "body",
      "fuel",
      "drive",
      "sort"
    ];

    const filters = {};

    for (const field of allowedFilters) {
      if (req.query[field] !== undefined) {
        filters[field] = String(req.query[field]).trim();
      }
    }

    const page = Number(req.query.page || 1);
    const per = Number(req.query.per || 20);

    if (!Number.isInteger(page) || page < 1 ||
        !Number.isInteger(per) || per < 1 || per > 50) {
      return res.status(400).json({
        success: false,
        error: "Invalid pagination parameters."
      });
    }

    filters.page = page;
    filters.per = per;
    filters.includeVariants = true;

    if (filters.modelYear !== undefined) {
      const year = Number(filters.modelYear);

      if (!Number.isInteger(year) || year < 1886 || year > 2100) {
        return res.status(400).json({
          success: false,
          error: "Invalid model year."
        });
      }

      filters.modelYear = year;
    }

    const params = {
      ...filters,
      variants: true
    };

    delete params.includeVariants;

    const cacheKey = buildCacheKey("browse", params);
    const cached = await getCachedResponse(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const result = await getCars(filters);

    await saveCachedResponse({
      cacheKey,
      type: "browse",
      data: result
    });

    return res.json(result);

  } catch (error) {
    console.error("CarVariables browse route error:", error.message);

    return res.status(502).json({
      success: false,
      error: error.message || "Vehicle browsing failed."
    });
  }
});

// ------------------------------------------------------------
// 3. GET CACHED GENERATION BY CARVARIABLES CODE
// GET /api/explore/generation/029sc4yvet
// ------------------------------------------------------------

router.get("/explore/generation/:code", async (req, res) => {
  try {
    const code = String(req.params.code || "").trim();

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: "Invalid generation code."
      });
    }

    const cachedDocuments = await CarCache.find({
      source: CACHE_SOURCE,
      type: { $in: ["search", "browse"] },
    expiresAt: { $gt: new Date() }
    }).select("data").lean();

    for (const document of cachedDocuments) {
      const results = document.data?.data?.results;

      if (!Array.isArray(results)) continue;

      const generation = results.find(car => car.code === code);

      if (generation) {
        return res.json({
          success: true,
          data: generation
        });
      }
    }

    return res.status(404).json({
      success: false,
      error: "Generation not found in cache. Search for the vehicle first."
    });

  } catch (error) {
    console.error("Generation lookup error:", error.message);

    return res.status(500).json({
      success: false,
      error: "Failed to retrieve vehicle generation."
    });
  }
});

// ------------------------------------------------------------
// LEGACY ROUTES — TEMPORARILY RETAINED
// ------------------------------------------------------------

router.get("/cachedCars", async (req, res) => {
  try {
    const cars = await CarCache.find({
      source: { $in: ["legacy", null] }
    });

    res.json(cars.map(car => car.data));

  } catch (error) {
    console.error("Failed to fetch legacy cached cars:", error.message);

    res.status(500).json({
      error: "Failed to fetch cached cars."
    });
  }
});

router.get("/explore", async (req, res) => {
  try {
    const { brand, model, year } = req.query;

    if (!brand || !model) {
      return res.status(400).json({
        error: "brand and model are required."
      });
    }

    const cacheQuery = {
      brand: normalizeValue(brand),
      model: normalizeValue(model),
      ...(year ? { year: String(year) } : {}),
      source: { $in: ["legacy", null] }
    };

    const cached = await CarCache.findOne(cacheQuery);

    if (cached) {
      return res.json(cached.data);
    }

    const carData = await getCarData({ brand, model, year });

    await CarCache.create({
      brand: normalizeValue(brand),
      model: normalizeValue(model),
      year: year || null,
      source: "legacy",
      type: "legacy",
      data: carData
    });

    return res.json(carData);

  } catch (error) {
    console.error("Legacy Explore API error:", error.message);

    return res.status(500).json({
      error: "Failed to fetch explore data."
    });
  }
});

module.exports = router;
