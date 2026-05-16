// services/carDataService.js
const axios = require("axios");

const CARSXE_API_KEY = process.env.CARSXE_API_KEY;
const CARSXE_API_URL = "https://api.carsxe.com/specs";

/**
 * Fetch car data from CARSXE API
 * @param {string} brand
 * @param {string} model
 * @param {string|number} year
 * @returns {object} car data
 */
async function getCarFromCarsXE(brand, model, year) {
  try {
    const response = await axios.get(CARSXE_API_URL, {
      params: {
        key: CARSXE_API_KEY,
        make: brand,
        model: model,
        year: year,
      },
    });

    const data = response.data;

    // If API returns an error or no data
    if (!data || data.error) {
      console.warn(`CARSXE API returned empty or error for ${brand} ${model} ${year}`);
      return null;
    }

    return data;
  } catch (err) {
    console.error("CARSXE API error:", err.response?.data || err.message);
    return null;
  }
}

/**
 * Merge API data into a structured car object for frontend
 * @param {object} params { brand, model, year }
 * @returns {object}
 */
async function getCarData({ brand, model, year }) {
  const carData = await getCarFromCarsXE(brand, model, year);

  // Return structured object even if API failed
  return {
    brand: brand || "Unknown",
    model: model || "Unknown",
    year: year || "Unknown",
    price: carData?.price || "Not available",
    colors: carData?.colors || ["Not available"],
    image: carData?.image || null,
    gallery: carData?.gallery || [],
    specs: carData || {},
    raw: carData || {},
  };
}

module.exports = { getCarData };
