const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Express app
const app = express();

// Middleware
app.use(cors({origin: true}));
app.use(express.json());

// Import routes
const urlRoutes = require("./routes/urlRoutes");

// Use routes
app.use("/", urlRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
