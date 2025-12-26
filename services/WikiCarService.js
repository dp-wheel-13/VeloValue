// services/WikiCarService.js
const axios = require("axios");
require("dotenv").config();

// ==========================
// CONFIG
// ==========================
const API_NINJA_KEY = process.env.API_NINJA_KEY;

// GitHub logos base URL
const GITHUB_LOGOS_BASE =
  "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/original";

// Default placeholder image
const DEFAULT_CAR_IMAGE = "https://via.placeholder.com/600x400?text=No+Image";

// ==========================
// HELPER FUNCTIONS
// ==========================

// Fetch car data from API Ninja
async function fetchCarFromAPI(carName) {
  try {
    const res = await axios.get(
      `https://api.api-ninjas.com/v1/cars?model=${encodeURIComponent(carName)}`,
      {
        headers: { "X-Api-Key": API_NINJA_KEY },
      }
    );
    return res.data[0] || null;
  } catch (err) {
    console.error(`API Ninja fetch error for ${carName}:`, err.message);
    return null;
  }
}

// Fetch image/logo from Wikipedia
async function fetchWikiImage(title) {
  try {
    const url = "https://en.wikipedia.org/w/api.php";
    const response = await axios.get(url, {
      headers: { "User-Agent": "VelovalueApp/1.0 (velovalue@gmail.com)" },
      params: {
        action: "query",
        format: "json",
        titles: title,
        prop: "pageimages",
        piprop: "original",
      },
    });

    const pages = response.data.query.pages;
    const pageId = Object.keys(pages)[0];
    return pages[pageId]?.original?.source || null;
  } catch (err) {
    console.error(`Wikipedia image fetch error for ${title}:`, err.message);
    return null;
  }
}

// Fetch car page from Wikipedia
async function fetchWikiPage(carName) {
  const variations = [
    carName,
    `${carName} (car)`,
    `${carName} (vehicle)`,
    `${carName} (${carName.split(" ")[0]})`,
  ];

  for (let title of variations) {
    try {
      const url = "https://en.wikipedia.org/w/api.php";
      const response = await axios.get(url, {
        headers: { "User-Agent": "VelovalueApp/1.0 (velovalue@gmail.com)" },
        params: {
          action: "query",
          format: "json",
          titles: title,
          prop: "pageimages|categories",
          piprop: "original",
        },
      });

      const pages = response.data.query.pages;
      const pageId = Object.keys(pages)[0];
      if (pages[pageId] && !pages[pageId].missing) return pages[pageId];
    } catch (err) {
      continue;
    }
  }

  return null;
}

// AI fallback for missing fields
async function generateAIField(fieldName, carName) {
  const dummyAI = {
    body: "SUV",
    drivetrain: "AWD",
    transmission: "8-speed automatic",
    power: "650 hp",
    torque: "850 Nm",
    "0-100 km/h": "3.6 sec",
    "top speed": "305 km/h",
    seats: 5,
    doors: 5,
    price: "$218,000",
    fuel: "Petrol",
    weight: "2200 kg",
    dimensions: "5113 x 2016 x 1638 mm",
    bootVolume: "616 L",
    wheelbase: "3003 mm",
    colors: ["Red", "Black", "White"],
    warranty: "3 years / 36,000 miles",
    euroNCAP: "Not rated",
    "WLTP range": null,
    "Battery (net)": null,
    "AC max": null,
    "DC max": null,
    "DC 10–80%": null,
    Connector: null,
    fuelConsumptionWLTP: "12.7 L/100km",
    energyConsumptionWLTP: null,
    "CO2 WLTP": "290 g/km",
    euroStandard: "Euro 6",
  };

  return dummyAI[fieldName] || "Not available";
}

// ==========================
// MAIN FUNCTION
// ==========================
async function getCarData({ brand, model, year }) {
  const carName = `${brand} ${model}`;
  const carData = { brand, model, year: year || "Unknown" };

  // Brand logo from GitHub dataset
  carData.brandLogo = `${GITHUB_LOGOS_BASE}/${brand.toLowerCase()}.png`;

  // Try API Ninja
  const apiData = await fetchCarFromAPI(carName);

  // Try Wikipedia
  const wikiData = await fetchWikiPage(carName);

  // Image fallback
  carData.image =
    apiData?.image || wikiData?.original?.source || DEFAULT_CAR_IMAGE;

  // Gallery fallback
  carData.gallery = apiData?.gallery || [];

  // All fields we want
  const fields = [
    "body",
    "drivetrain",
    "transmission",
    "power",
    "torque",
    "0-100 km/h",
    "top speed",
    "seats",
    "doors",
    "price",
    "fuel",
    "weight",
    "dimensions",
    "bootVolume",
    "wheelbase",
    "colors",
    "warranty",
    "euroNCAP",
    "WLTP range",
    "Battery (net)",
    "AC max",
    "DC max",
    "DC 10–80%",
    "Connector",
    "fuelConsumptionWLTP",
    "energyConsumptionWLTP",
    "CO2 WLTP",
    "euroStandard",
  ];

  for (let field of fields) {
    carData[field] =
      apiData?.[field] ||
      wikiData?.[field] ||
      (await generateAIField(field, carName));
  }

  return carData;
}

module.exports = { getCarData };
