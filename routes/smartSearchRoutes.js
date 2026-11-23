const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const router = express.Router();

router.post("/smartsearch/analyze", async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: "Please log in first." });
    }

    const { imageBase64, mimeType = "image/jpeg" } = req.body || {};

    if (!imageBase64 || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return res.status(400).json({ error: "A valid vehicle image is required." });
    }

    if (imageBase64.length > 3500000) {
      return res.status(413).json({ error: "Image is too large. Please take another picture." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is not configured." });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
Identify the vehicle in this image.

Determine whether it is a four-wheeled passenger car.
If it is not, return:
{
  "isCar": false,
  "detectedAs": "description",
  "make": "N/A",
  "model": "N/A",
  "year": "Unknown",
  "bodyType": "N/A",
  "confidence": 0,
  "technicalSpecs": {}
}

If it is a car, identify its make, exact model if possible, likely model year or generation, and body type.

Return technical specifications where you can reliably identify the exact vehicle:
engine, fuelType, displacement, power, torque, transmission, drivetrain, seats, length, width, height, bootCapacity, fuelConsumption, CO2Emissions.

Do not invent specifications. Use null for unknown values.
If the exact variant or model year cannot be established from the image, say so.
Return only valid JSON with these fields:
isCar, make, model, year, bodyType, confidence, technicalSpecs.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      }],
      config: { responseMimeType: "application/json" }
    });

    const result = JSON.parse(response.text);
    return res.json(result);

  } catch (error) {
    console.error("[Smart Search Gemini Error]", error);
    return res.status(500).json({
      error: error.message || "Vehicle recognition failed."
    });
  }
});

module.exports = router;
