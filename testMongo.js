const mongoose = require("mongoose");

const MONGO_URI = "mongodb+srv://velovalue:ob4PrtoHdmFj8zA6@velovalue-cluster.ycpmqjy.mongodb.net/velovalue?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ MongoDB connection test successful!");
    mongoose.connection.close(); // close connection after test
  })
  .catch(err => {
    console.error("❌ MongoDB connection test failed:", err);
  });
