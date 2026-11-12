
const express = require("express");
const axios = require("axios");
const router = express.Router();
const Garage = require("../models/Garage");

// Wikimedia Commons API
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// Normalize registration plates
function normalizePlate(plate) {
  if (typeof plate !== "string") return "";
  return plate.replace(/[\s-]/g, "").toUpperCase();
}

// Safely clean optional text values
function cleanText(value) {
  if (value === undefined || value === null) return null;

  const cleaned = String(value).trim();
  return cleaned ? cleaned : null;
}

// Clean basic HTML from Wikimedia metadata
function cleanMetadata(value) {
  if (!value) return null;

  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim() || null;
}

// Convert text into searchable filename tokens
function getSearchTokens(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Extract the actual model name and generation from InfoTarga
function getModelInfo(model) {
  const raw = String(model || "").trim();

  const generationMatch = raw.match(
    /\b([1-9])(?:ª|a|°)?\s*(?:serie|series|generation|gen)\b/i
  );

  const romanGenerations = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX"
  };

  const generation = generationMatch
    ? romanGenerations[Number(generationMatch[1])]
    : null;

  const stopWords = [
    "serie",
    "series",
    "generation",
    "gen"
  ];

  const tokens = getSearchTokens(raw).filter(token => {
    if (stopWords.includes(token)) return false;
    if (/^\d+$/.test(token)) return false;
    return true;
  });

  return {
    tokens,
    generation
  };
}

// Search Wikimedia Commons and retrieve an image with licence metadata
async function searchCommonsImage(
  query,
  type,
  brand,
  model = null,
  year = null
) {
  try {
    const response = await axios.get(COMMONS_API, {
      params: {
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrnamespace: 6,
        gsrlimit: 30,
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        iiurlwidth: 1000,
        format: "json",
        formatversion: 2
      },
      headers: {
        "User-Agent": "VeloValue/1.0 (https://velovalue.it)"
      },
      timeout: 10000
    });

    const pages = response.data?.query?.pages || [];

    const brandTokens = getSearchTokens(brand);
    const modelInfo = type === "vehicle"
      ? getModelInfo(model)
      : { tokens: [], generation: null };

    const candidates = [];

    for (const page of pages) {
      const imageInfo = page.imageinfo?.[0];
      if (!imageInfo) continue;

      const title = page.title || "";
      const titleLower = title.toLowerCase();

      const titleWords = getSearchTokens(
        title
          .replace(/^File:/i, "")
          .replace(/\.[^.]+$/, "")
      );

      const metadata = imageInfo.extmetadata || {};

      // Require the manufacturer name in the filename.
      if (!brandTokens.every(token => titleWords.includes(token))) {
        continue;
      }

      let score = 0;

      // VEHICLE PHOTOGRAPH MATCHING
      if (type === "vehicle") {
        // Require the core model name, not descriptive suffixes.
        if (!modelInfo.tokens.length) continue;

        if (!modelInfo.tokens.every(token => titleWords.includes(token))) {
          continue;
        }

        // Exclude logos and non-exterior photographs.
        if (
          /\b(logo|logotyp|emblem|badge|symbol|icon|interior|dashboard|cockpit|display|steering|seat|engine|wheel|tire)\b/i.test(titleLower)
        ) {
          continue;
        }

        score += 10;

        // Prefer the requested generation.
        if (
          modelInfo.generation &&
          titleWords.includes(modelInfo.generation.toLowerCase())
        ) {
          score += 12;
        }

        // Prefer photographs matching the registration year.
        if (year && titleWords.includes(String(year))) {
          score += 8;
        }

        // Prefer exterior front views.
        if (/\b(front|frontview)\b/i.test(titleLower)) {
          score += 4;
        }

        // Slight preference for actual car photographs.
        if (/\b(car|automobile|vehicle)\b/i.test(titleLower)) {
          score += 2;
        }
      }

      // MANUFACTURER LOGO MATCHING
      if (type === "logo") {
        if (!/\b(logo|logotyp|emblem|badge)\b/i.test(titleLower)) {
          continue;
        }

        // Reject unrelated manufacturers and subsidiary branding.
        if (
          /\b(nintendo|scania|nevs|faw|truck|lorry|dealer|versicherung|versicherungsdienst)\b/i.test(titleLower)
        ) {
          continue;
        }

        // DS is ambiguous: require the automotive brand name.
        if (
          brandTokens.length === 1 &&
          brandTokens[0] === "ds" &&
          !titleWords.includes("automobiles")
        ) {
          continue;
        }

        score += 10;

        // Prefer contemporary logos.
        if (/\b(2019|2020|2021|2022|2023|2024|2025|2026|current|modern|present)\b/i.test(titleLower)) {
          score += 12;
        }

        // Penalize outdated branding.
        if (/\b(1939|1943|1965|1995|vintage|historic|historical|old)\b/i.test(titleLower)) {
          score -= 20;
        }
      }

      // Reject non-free images.
      const nonFree = cleanMetadata(metadata.NonFree?.value);

      if (nonFree && nonFree.toLowerCase() === "true") {
        continue;
      }

      // Require licence information.
      const license = cleanMetadata(
        metadata.LicenseShortName?.value ||
        metadata.UsageTerms?.value
      );

      if (!license) continue;

      const imageUrl = imageInfo.thumburl || imageInfo.url;
      if (!imageUrl) continue;

      candidates.push({
        score,
        url: imageUrl,
        sourcePage: imageInfo.descriptionurl || null,
        artist: cleanMetadata(
          metadata.Artist?.value ||
          metadata.Credit?.value
        ),
        license,
        licenseUrl: cleanMetadata(metadata.LicenseUrl?.value)
      });
    }

    candidates.sort((a, b) => b.score - a.score);

    return candidates[0] || null;

  } catch (err) {
    console.error(
      `[Wikimedia] ${type} image search failed:`,
      err.message
    );

    return null;
  }
}

// Retrieve vehicle photograph and manufacturer logo
// Retrieve vehicle image and manufacturer logo from CarImages API
async function getCarImagesAssets(brand, model) {
  const assets = {
    img: null,
    logo: null
  };

  const cleanBrand = cleanText(brand);
  const cleanModel = cleanText(model);

  if (!cleanBrand || cleanBrand === "Unknown") {
    return assets;
  }

  const apiKey = process.env.CARIMAGES_API_KEY;

  // Retrieve vehicle image only when both brand and model are available
  const vehicleImagePromise =
    cleanModel && cleanModel !== "Unknown" && apiKey
      ? axios.get("https://carimagesapi.com/image", {
          params: {
            make: cleanBrand,
            model: cleanModel,
            width: 800,
            key: apiKey
          },
          responseType: "arraybuffer",
          timeout: 15000
        })
      : Promise.resolve(null);

  // Manufacturer logo does not require an API key
  const logoPromise = axios.get(
    "https://carimagesapi.com/brand-logo",
    {
      params: {
        make: cleanBrand
      },
      responseType: "arraybuffer",
      timeout: 15000
    }
  );

  const [vehicleResult, logoResult] = await Promise.allSettled([
    vehicleImagePromise,
    logoPromise
  ]);

  if (
    vehicleResult.status === "fulfilled" &&
    vehicleResult.value
  ) {
    const response = vehicleResult.value;
    const contentType = response.headers["content-type"] || "image/webp";

    assets.img =
      `data:${contentType};base64,` +
      Buffer.from(response.data).toString("base64");
  } else if (vehicleResult.status === "rejected") {
    console.error(
      "[CarImages] Vehicle image failed:",
      vehicleResult.reason.message
    );
  }

  if (logoResult.status === "fulfilled") {
    const response = logoResult.value;
    const contentType = response.headers["content-type"] || "image/png";

    assets.logo =
      `data:${contentType};base64,` +
      Buffer.from(response.data).toString("base64");
  } else {
    console.error(
      "[CarImages] Manufacturer logo failed:",
      logoResult.reason.message
    );
  }

  return assets;
}

// ROUTE 1: SmartGarage Entry
router.get("/garage-entry", async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.json({ status: "NOT_AUTHENTICATED" });
    }

    const garage = await Garage.findOne({
      userId: req.session.user.id
    });

    if (!garage || !garage.vehicles || garage.vehicles.length === 0) {
      return res.json({ status: "NO_CAR" });
    }

    return res.json({ status: "HAS_CAR" });

  } catch (err) {
    console.error("Garage check failed:", err);
    return res.status(500).json({ status: "ERROR" });
  }
});

// ROUTE 2: Search & Add Car
router.post("/garage/search", async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not logged in"
      });
    }

    const userId = req.session.user.id;

    const {
      plate,
      brand,
      model,
      fuel,
      year,
      img,
      logo,
      vin,
      registrationPlace,
      euroClass,
      insuranceStatus,
      inspectionStatus,
      inspectionDueDate,
      theftReported
    } = req.body;

    const normalizedPlate = normalizePlate(plate);

    if (!normalizedPlate) {
      return res.status(400).json({
        success: false,
        message: "Valid plate number required"
      });
    }

    let garage = await Garage.findOne({ userId });

    if (!garage) {
      garage = new Garage({
        userId,
        vehicles: []
      });
    }

    // Prevent duplicate registration plates
    const alreadyExists = garage.vehicles.some(
      vehicle => normalizePlate(vehicle.plate) === normalizedPlate
    );

    if (alreadyExists) {
      return res.json({
        success: true,
        alreadyExists: true,
        message: "Car already in garage"
      });
    }

    // Build vehicle record
    const carDetails = {
      plate: normalizedPlate,
      make: cleanText(brand) || "Unknown",
      brand: cleanText(brand) || "Unknown",
      model: cleanText(model) || "Unknown"
    };

    // Optional vehicle information
    const optionalFields = {
      fuel,
      vin,
      registrationPlace,
      euroClass,
      insuranceStatus,
      inspectionStatus,
      inspectionDueDate
    };

    for (const [field, value] of Object.entries(optionalFields)) {
      const cleaned = cleanText(value);

      if (cleaned !== null) {
        carDetails[field] = cleaned;
      }
    }

    // Save year only when valid
    let numericYear = null;

    if (year !== undefined && year !== null && year !== "") {
      numericYear = Number(year);

      if (Number.isFinite(numericYear)) {
        carDetails.year = numericYear;
      } else {
        numericYear = null;
      }
    }

    // Preserve false as a valid theft-check result
    if (typeof theftReported === "boolean") {
      carDetails.theftReported = theftReported;
    }

    // Retrieve images from Wikimedia Commons
    // Retrieve images from CarImages API
const assets = await getCarImagesAssets(
  carDetails.brand,
  carDetails.model
);

const suppliedImg = cleanText(img);
const suppliedLogo = cleanText(logo);

carDetails.img = suppliedImg || assets.img;
carDetails.logo = suppliedLogo || assets.logo;

console.log("[CarImages] Brand:", carDetails.brand);
console.log("[CarImages] Model:", carDetails.model);
console.log("[CarImages] Vehicle image found:", Boolean(carDetails.img));
console.log("[CarImages] Manufacturer logo found:", Boolean(carDetails.logo));

    // Save attribution only for images actually retrieved from Wikimedia
    if (!suppliedImg && assets.img) {
  carDetails.imgSourcePage = assets.imgSourcePage;
  carDetails.imgArtist = assets.imgArtist;
  carDetails.imgLicense = assets.imgLicense;
  carDetails.imgLicenseUrl = assets.imgLicenseUrl;
}

    if (!suppliedLogo && assets.logo) {
  carDetails.logoSourcePage = assets.logoSourcePage;
  carDetails.logoArtist = assets.logoArtist;
  carDetails.logoLicense = assets.logoLicense;
  carDetails.logoLicenseUrl = assets.logoLicenseUrl;
}

    garage.vehicles.push(carDetails);

    await garage.save();

    return res.json({
      success: true,
      message: "Car added successfully",
      images: {
        vehicleImageFound: Boolean(carDetails.img),
        manufacturerLogoFound: Boolean(carDetails.logo)
      }
    });

  } catch (err) {
    console.error("Error in /garage/search:", err);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ROUTE 3: Get User Status
router.get("/api/user-status", (req, res) => {
  if (req.session.user && req.session.user.id) {
    return res.json({
      loggedIn: true,
      user: {
        id: req.session.user.id,
        name: req.session.user.name,
        email: req.session.user.email
      }
    });
  }

  return res.json({
    loggedIn: false,
    user: null
  });
});

// ROUTE 4: Remove Exactly One Car
router.post("/garage/remove-car", async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not logged in"
      });
    }

    const normalizedPlate = normalizePlate(req.body.plate);

    if (!normalizedPlate) {
      return res.status(400).json({
        success: false,
        message: "Valid plate number required"
      });
    }

    const garage = await Garage.findOne({
      userId: req.session.user.id
    });

    if (!garage) {
      return res.status(404).json({
        success: false,
        message: "Garage not found"
      });
    }

    // Find the first matching vehicle only
    const vehicleIndex = garage.vehicles.findIndex(
      vehicle => normalizePlate(vehicle.plate) === normalizedPlate
    );

    if (vehicleIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found"
      });
    }

    // Remove only one matching vehicle
    garage.vehicles.splice(vehicleIndex, 1);

    await garage.save();

    return res.json({
      success: true,
      message: "Car removed successfully"
    });

  } catch (err) {
    console.error("Error removing car:", err);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ROUTE 5: Get User's Vehicles
router.get("/api/garage/vehicles", async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not logged in"
      });
    }

    const garage = await Garage.findOne({
      userId: req.session.user.id
    });

    if (!garage || !garage.vehicles) {
      return res.json({
        success: true,
        vehicles: []
      });
    }

    return res.json({
      success: true,
      vehicles: garage.vehicles
    });

  } catch (err) {
    console.error("Error fetching vehicles:", err);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

module.exports = router;
