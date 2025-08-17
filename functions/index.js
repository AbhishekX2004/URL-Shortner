const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

admin.initializeApp();
const app = express();

app.use(cors({origin: true}));
app.use(express.json());

const urlRoutes = require("./routes/urlRoutes");
app.use("/", urlRoutes);
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

exports.api = functions.https.onRequest(app);
