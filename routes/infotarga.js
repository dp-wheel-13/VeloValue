const express = require('express');
const axios = require('axios');

const router = express.Router();

const API_KEY = process.env.INFOTARGA_API_KEY;
if (!API_KEY) {
  console.warn('⚠️  INFOTARGA_API_KEY is not set in .env - InfoTarga routes will fail.');
}

// Reusable function to call InfoTarga
async function fetchPlateFromInfoTarga(plate) {
  const normalizedPlate = plate.toUpperCase().trim();
  const url = `https://infotarga.com/api/query/${encodeURIComponent(normalizedPlate)}`;

  const body = {
    vehicleType: 'car',            // adjust if needed: car | motorcycle | moped | trailer | truck
    includeDetails: true,          // basic vehicle info
    includeInsurance: true,        // insurance info
    includeEmissions: true,        // environmental class
    includeLicenseEligibility: false,
    includeInspection: false,      // Pro/Ultra
    includeTheft: false            // Pro/Ultra
  };

  const response = await axios.post(url, body, {
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return response.data; // full InfoTarga response body
}

// Core handler used by both endpoints
async function handlePlateLookup(req, res) {
  const plate = req.params.plate;

  if (!plate) {
    return res.status(400).json({
      success: false,
      message: 'Plate is required'
    });
  }

  if (!API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'INFOTARGA_API_KEY is not configured on the server'
    });
  }

  try {
    const infoTargaResponse = await fetchPlateFromInfoTarga(plate);
    const { error, status, message, code, overQuota, data } = infoTargaResponse;

    if (error) {
      return res.status(status || 500).json({
        success: false,
        source: 'InfoTarga',
        message,
        code,
        overQuota
      });
    }

    // Insurance compliant status if available
    let insuranceCompliant = null;
    if (data && data.insurance && typeof data.insurance.compliant === 'boolean') {
      insuranceCompliant = data.insurance.compliant;
    }

    return res.json({
      success: true,
      plate: plate.toUpperCase().trim(),
      insuranceCompliant,
      info: data
    });
  } catch (err) {
    console.error('InfoTarga error:', err.message);

    if (err.response && err.response.data) {
      return res.status(err.response.status).json({
        success: false,
        source: 'InfoTarga/HTTP',
        ...(typeof err.response.data === 'object'
          ? err.response.data
          : { message: 'Error from InfoTarga API' })
      });
    }

    return res.status(500).json({
      success: false,
      source: 'Server',
      message: 'Internal server error'
    });
  }
}

/**
 * GET /api/infotarga/:plate
 * Example: /api/infotarga/AA123BB
 */
router.get('/infotarga/:plate', handlePlateLookup);

/**
 * GET /api/lookup/:plate
 * Alias endpoint if you already use /api/lookup/:plate in the frontend.
 */
router.get('/lookup/:plate', handlePlateLookup);

module.exports = router;