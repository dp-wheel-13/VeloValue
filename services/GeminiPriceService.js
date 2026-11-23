const { GoogleGenAI } = require("@google/genai");

const MODEL = "gemini-3.8-flash";
const OFFICIAL_MANUFACTURER_DOMAINS = {
  peugeot: ["peugeot.it", "peugeot.com"],
  bmw: ["bmw.com"],
  mercedesbenz: ["mercedes-benz.com"],
  volkswagen: ["volkswagen.com"],
  audi: ["audi.com"],
  toyota: ["toyota.com"],
  renault: ["renault.com"],
  dacia: ["dacia.com"],
  fiat: ["fiat.com"],
  ford: ["ford.com"],
  hyundai: ["hyundai.com"],
  kia: ["kia.com"],
  nissan: ["nissan.com"],
  honda: ["honda.com"],
  mazda: ["mazda.com"],
  skoda: ["skoda-auto.com"],
  seat: ["seat.com"],
  cupra: ["cupraofficial.com"],
  opel: ["opel.com"],
  citroen: ["citroen.com"],
  dsautomobiles: ["dsautomobiles.com"],
  alfaromeo: ["alfaromeo.com"],
  jeep: ["jeep.com"],
  volvo: ["volvocars.com"],
  tesla: ["tesla.com"],
  porsche: ["porsche.com"],
  lexus: ["lexus.com"],
  suzuki: ["suzuki.com"],
  landrover: ["landrover.com"],
  jaguar: ["jaguar.com"],
  mini: ["mini.com"],
  byd: ["byd.com"],
  mg: ["mgmotor.eu"],
  smart: ["smart.com"]
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function extractJson(text) {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  return JSON.parse(cleaned);
}

function priceAppearsOnPage(pageText, price) {
  const amount = Math.round(Number(price));
  if (!Number.isFinite(amount) || amount <= 0) return false;

  const amountPattern = String(amount).split("").join("[\\s.,'’\\u00a0]*");
  const amountFound = new RegExp(
    "(^|\\D)" + amountPattern + "(\\D|$)"
  ).test(pageText);

  const priceContextFound =
    /prezzo\s*(di\s*)?listino|listino\s*prezzi|list\s*price|recommended\s*retail\s*price|\bmsrp\b|\brrp\b|\buvp\b|offerta|promozione|prezzo\s*(promo|promozionale)|a partire da|prix\s*(public|catalogue)/i.test(pageText);

  const ivaFound =
    /iva\s*(inclusa|compresa)|iva.*inclus|vat\s*included|incl\.?\s*vat|including\s*vat|mwst\.?\s*inkl|inklusive\s*mwst|tva\s*incluse|ttc\b|iva\s*incluido|impuestos\s*incluidos|all\s*taxes\s*included/i.test(pageText);

  return amountFound && priceContextFound && ivaFound;
}

async function verifyOfficialSource(url, make, model, generation, modelYear, price) {
  try {
    const initialUrl = new URL(url);

    if (initialUrl.protocol !== "https:") return null;

    const response = await fetch(initialUrl.href, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "VeloValue-PriceVerifier/1.0"
      }
    });

    if (!response.ok) return null;

    const finalUrl = new URL(response.url);

        if (finalUrl.protocol !== "https:") return null;

    const normalizedMake = normalizeText(make);
    const allowedDomains = OFFICIAL_MANUFACTURER_DOMAINS[normalizedMake] || [];

    const isOfficialDomain = allowedDomains.some(domain =>
      finalUrl.hostname === domain ||
      finalUrl.hostname.endsWith("." + domain)
    );

    if (!isOfficialDomain) return null;
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) return null;

    const html = await response.text();

    const pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&euro;/gi, "€")
      .replace(/&#8364;/gi, "€")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .toLowerCase();

    const normalizedPage = normalizeText(pageText);
    const normalizedModel = normalizeText(model);
    const normalizedGeneration = normalizeText(generation);
    const normalizedYear = modelYear == null ? "" : normalizeText(modelYear);

    if (!normalizedModel || !normalizedPage.includes(normalizedModel)) {
      return null;
    }

    if (
      normalizedGeneration &&
      normalizedGeneration !== normalizedModel &&
      !normalizedPage.includes(normalizedGeneration)
    ) {
      return null;
    }

    if (normalizedYear && !normalizedPage.includes(normalizedYear)) {
      return null;
    }

    if (!priceAppearsOnPage(pageText, price)) return null;

    return {
      url: finalUrl.href,
      title: finalUrl.hostname
    };
  } catch (error) {
    console.warn("[Gemini Price] Source verification failed:", error.message);
    return null;
  }
}

async function getVerifiedItalianStartingPrice({ make, model, modelYear = null, generation = null }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  if (!make || !model) {
    throw new Error("Vehicle make and model are required.");
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

    const prompt = `
Research the exact vehicle selected in VeloValue:

Manufacturer: ${make}
Model: ${model}
Generation: ${generation || "Not provided"}
Model year: ${modelYear || "Not provided"}
Market: Italy

Find the currently published Italian cash purchase price for this
exact brand-new vehicle.

STRICT REQUIREMENTS:
- Search Italian manufacturer websites first.
- Use Google Search to find current official Italian pricing.
- Match the exact manufacturer, model and generation/year.
- Do not substitute a different generation, facelift or model year.
- Price must be in EUR and include Italian IVA.
- Prefer the official manufacturer's Italian list price.
- An official manufacturer cash promotion is acceptable if currently valid.
- Exclude used, pre-registered and demonstration vehicles.
- Exclude leasing, financing instalments and conditional finance prices.
- Do not estimate, calculate or invent a price.
- The source URL must be the actual page supporting the price.
- If exact vehicle identity, price or IVA inclusion cannot be verified,
  return null for price_eur.

Return JSON only:
{
  "price_eur": number or null,
  "price_type": "list" or "promotional" or "unknown",
  "market": "IT",
  "iva_included": true or false,
  "new_vehicle": true or false,
  "model_match": true or false,
  "generation_match": true or false,
  "source_url": "URL or null",
  "source_evidence": "Short evidence identifying the vehicle and price",
  "valid_until": "YYYY-MM-DD or null"
}
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  console.log("[Price Debug] Candidate metadata:", JSON.stringify(response.candidates?.[0]?.groundingMetadata || null, null, 2));
  const result = extractJson(response.text);
  console.log("[Price Debug] Gemini result:", JSON.stringify(result, null, 2));

  if (!Number.isFinite(Number(result.price_eur)) || Number(result.price_eur) <= 0) {
    console.log("[Price Debug] Rejected: Gemini returned no valid starting price.");
    return null;
  }

  console.log("[Price Debug] Accepted starting price:", result.price_eur);

  return {
    make,
    model,
    generation,
    modelYear,
    startingPrice: Math.round(Number(result.price_eur)),
    currency: "EUR",
    market: "IT",
    priceType: ["list", "promotional"].includes(result.price_type) ? result.price_type : "list",
    ivaIncluded: result.iva_included === true,
    sourceUrl: result.source_url || null,
    sourceTitle: result.source_url ? new URL(result.source_url).hostname : null,
    sourceEvidence: result.source_evidence || null,
    validUntil: result.valid_until ? new Date(result.valid_until) : null,
    verified: false,
    lastCheckedAt: new Date()
  };
}

module.exports = {
  getVerifiedItalianStartingPrice
};








