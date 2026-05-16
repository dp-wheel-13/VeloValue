const mongoose = require("mongoose");
const CarCache = require("./models/CarCache");

const MONGO_URI = process.env.MONGO_URI || "YOUR_MONGO_URI";

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("✅ MongoDB connected");
    const res = await CarCache.deleteMany({});
    console.log("🗑️ Cache cleared:", res.deletedCount, "documents removed");
    mongoose.disconnect();
  })
  .catch(err => console.error(err));
