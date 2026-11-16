
const axios = require("axios");

const CARVARIABLES_API_URL = "https://api.carvariables.com";
const CARVARIABLES_API_KEY = process.env.CARVARIABLES_API_KEY;

/**
 * Search vehicle generations using CarVariables.
 *
 * @param {Object} params
 * @param {string} params.query - Search text, e.g. "BMW M3 2024"
 * @param {number} params.page
 * @param {number} params.per
 * @param {boolean} params.includeVariants
 * @returns {Promise<Object>}
 */
async function searchCars({
  query,
  page = 1,
  per = 20,
  includeVariants = true,
} = {}) {
  if (!CARVARIABLES_API_KEY) {
    throw new Error("CARVARIABLES_API_KEY is not configured");
  }

  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("A vehicle search query is required");
  }

  try {
    const response = await axios.get(
      `${CARVARIABLES_API_URL}/v1/search`,
      {
        params: {
          q: query.trim(),
          page,
          per,
          variants: includeVariants ? 1 : undefined,
        },
        headers: {
          "X-API-Key": CARVARIABLES_API_KEY,
        },
        timeout: 15000,
      }
    );

    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const apiError = error.response?.data;

    console.error("CarVariables search error:", {
      status,
      error: apiError || error.message,
    });

    if (status === 401 || status === 403) {
      throw new Error("CarVariables authentication failed. Check the API key.");
    }

    if (status === 429) {
      throw new Error("CarVariables monthly API quota or request limit exceeded.");
    }

    if (status >= 500) {
      throw new Error("CarVariables service is temporarily unavailable.");
    }

    throw new Error(
      apiError?.error || "Failed to search vehicles with CarVariables."
    );
  }
}

/**
 * Browse vehicle generations using structured filters.
 *
 * @param {Object} filters
 * @returns {Promise<Object>}
 */

async function getCars(filters = {}) {
  if (!CARVARIABLES_API_KEY) {
    throw new Error("CARVARIABLES_API_KEY is not configured");
  }

  const {
    includeVariants = true,
    ...apiFilters
  } = filters;

  try {
    const response = await axios.get(
      `${CARVARIABLES_API_URL}/v1/cars`,
      {
        params: {
          ...apiFilters,
          variants: includeVariants ? 1 : undefined,
        },
        headers: {
          "X-API-Key": CARVARIABLES_API_KEY,
        },
        timeout: 15000,
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "CarVariables browse error:",
      error.response?.data || error.message
    );

    if (error.response?.status === 429) {
      throw new Error("CarVariables API quota exceeded.");
    }

    throw new Error(
      error.response?.data?.error ||
      "Failed to retrieve vehicles from CarVariables."
    );
  }
}

module.exports = {
  searchCars,
  getCars,
};
