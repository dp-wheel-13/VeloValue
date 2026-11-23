const CarPrice = require("../models/CarPrice");
const {
  getVerifiedItalianStartingPrice
} = require("./GeminiPriceService");

const MONTHLY_REFRESH_DAYS = 30;
const RETRY_HOURS = 24;

const pendingRequests = new Map();

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeYear(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const year = Number(value);

  return Number.isInteger(year) && year > 0 ? year : null;
}

function nextRefreshDate() {
  const date = new Date();
  date.setDate(date.getDate() + MONTHLY_REFRESH_DAYS);
  return date;
}

function retryDate() {
  const date = new Date();
  date.setHours(date.getHours() + RETRY_HOURS);
  return date;
}

async function getStartingPrice(make, model, modelYear = null, generation = null) {
  if (!make || !model) return null;

  const normalizedMake = normalizeKey(make);
  const normalizedModel = normalizeKey(model);
  const normalizedYear = normalizeYear(modelYear);
  const normalizedGeneration = normalizeKey(generation);

  const cacheQuery = {
    make: normalizedMake,
    model: normalizedModel,
    generation: normalizedGeneration || null,
    modelYear: normalizedYear,
    market: "IT"
  };

  const existing = await CarPrice.findOne(cacheQuery);
  const now = new Date();

  if (
    existing &&
    existing.startingPrice > 0 &&
    existing.nextCheckAt &&
    existing.nextCheckAt > now
  ) {
    return existing.startingPrice;
  }

  const requestKey =
    `${normalizedMake}:${normalizedModel}:${normalizedGeneration}:${normalizedYear ?? "unknown"}`;

  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey);
  }

  const request = (async () => {
    try {
      const verifiedPrice = await getVerifiedItalianStartingPrice({
        make,
        model,
        modelYear: normalizedYear,
        generation
      });

      if (
        !verifiedPrice ||
        
        !Number.isFinite(Number(verifiedPrice.startingPrice)) ||
        Number(verifiedPrice.startingPrice) <= 0
      ) {
        throw new Error("No valid starting price returned.");
      }

      const nextCheckAt = nextRefreshDate();

      await CarPrice.findOneAndUpdate(
        cacheQuery,
        {
          $set: {
            ...verifiedPrice,
            make: normalizedMake,
            model: normalizedModel,
            modelYear: normalizedYear,
            generation: normalizedGeneration || null,
            market: "IT",
            nextCheckAt,
            lastCheckedAt: now,
            lastAttemptAt: now
          }
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true
        }
      );

      return Number(verifiedPrice.startingPrice);
    } catch (error) {
      console.error(
        `[CarPrice] Lookup failed for ${make} ${model} (${normalizedYear || "year unknown"}):`,
        error.message
      );

      if (existing) {
        await CarPrice.updateOne(
          { _id: existing._id },
          {
            $set: {
              lastAttemptAt: now,
              nextCheckAt: retryDate()
            }
          }
        ).catch(updateError => {
          console.error(
            "[CarPrice] Could not update retry date:",
            updateError.message
          );
        });

        return existing.startingPrice > 0 ? existing.startingPrice : null;
      }

      return null;
    } finally {
      pendingRequests.delete(requestKey);
    }
  })();

  pendingRequests.set(requestKey, request);
  return request;
}

module.exports = {
  getStartingPrice
};

