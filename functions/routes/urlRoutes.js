/* eslint-disable new-cap */
/* eslint-disable no-constant-condition */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const Redis = require("ioredis");

// Initialize Firestore
const db = admin.firestore();

// Initialize Redis client
let redis;
try {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    redis = new Redis(redisUrl, {
      retryDelayOnFailure: () => 100,
      maxRetriesPerRequest: 3,
    });

    redis.on("error", (err) => {
      console.error("Redis connection error:", err);
    });
  }
} catch (error) {
  console.error("Redis initialization error:", error);
}

// Generate short code
function generateShortCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

// POST /api/shorten - Create shortened URL
router.post("/shorten", async (req, res) => {
  try {
    const {originalUrl} = req.body;

    // Validate input
    if (!originalUrl) {
      return res.status(400).json({
        error: "Original URL is required",
      });
    }
    if (!isValidUrl(originalUrl)) {
      return res.status(400).json({
        error: "Please provide a valid URL with http:// or https://",
      });
    }

    // Check if URL already exists in cache
    let existingShortCode = null;
    if (redis) {
      try {
        existingShortCode = await redis.get(`url:${originalUrl}`);
      } catch (error) {
        console.warn("Redis get error:", error);
      }
    }

    if (existingShortCode) {
      return res.status(200).json({
        shortCode: existingShortCode,
        originalUrl: originalUrl,
        shortUrl: `${process.env.BASE_URL}/${existingShortCode}`,
        cached: true,
      });
    }

    // Generate unique short code
    let shortCode;
    let attempts = 0;
    const maxAttempts = 10;
    do {
      shortCode = generateShortCode();
      attempts++;

      // Check if short code already exists in Firestore
      const existingDoc = await db.collection("urls").doc(shortCode).get();
      if (!existingDoc.exists) break;

      if (attempts >= maxAttempts) {
        return res.status(500).json({
          error: "Unable to generate unique short code. Please try again.",
        });
      }
    } while (true);

    // Create URL document
    const urlData = {
      originalUrl: originalUrl,
      shortCode: shortCode,
      clicks: 0,
      createdAt: new Date(),
      lastAccessed: null,
    };

    // Save to Firestore
    await db.collection("urls").doc(shortCode).set(urlData);

    // Cache in Redis (with 1 hour expiration)
    if (redis) {
      try {
        await Promise.all([
          redis.setex(`url:${originalUrl}`, 3600, shortCode),
          redis.setex(`code:${shortCode}`, 3600, originalUrl),
        ]);
      } catch (error) {
        console.warn("Redis cache error:", error);
      }
    }

    res.status(201).json({
      shortCode: shortCode,
      originalUrl: originalUrl,
      shortUrl: `${process.env.BASE_URL}/${shortCode}`,
      cached: false,
    });
  } catch (error) {
    console.error("Error creating short URL:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// GET /api/url/:shortCode - Get original URL and redirect
router.get("/url/:shortCode", async (req, res) => {
  try {
    const {shortCode} = req.params;
    if (!shortCode) {
      return res.status(400).json({
        error: "Short code is required",
      });
    }

    // Try to get from Redis cache first
    let originalUrl = null;
    if (redis) {
      try {
        originalUrl = await redis.get(`code:${shortCode}`);
      } catch (error) {
        console.warn("Redis get error:", error);
      }
    }

    // If not in cache, get from Firestore
    if (!originalUrl) {
      const urlDoc = await db.collection("urls").doc(shortCode).get();

      if (!urlDoc.exists) {
        return res.status(404).json({
          error: "Short URL not found",
        });
      }

      const urlData = urlDoc.data();
      originalUrl = urlData.originalUrl;

      // Cache it in Redis for future requests
      if (redis) {
        try {
          await redis.setex(`code:${shortCode}`, 3600, originalUrl);
        } catch (error) {
          console.warn("Redis cache error:", error);
        }
      }
    }

    // Increment click count in background (don't wait)
    db.collection("urls").doc(shortCode).get()
        .then((doc) => {
          if (doc.exists) {
            const currentClicks = doc.data().clicks || 0;
            return db.collection("urls").doc(shortCode).update({
              clicks: currentClicks + 1,
              lastAccessed: new Date(),
            });
          } else {
            console.warn("Document does not exist for shortCode:", shortCode);
          }
        })
        .catch((error) => {
          console.error("Error updating click count:", error);
        });


    // Redirect to original URL
    res.redirect(301, originalUrl);
  } catch (error) {
    console.error("Error retrieving URL:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// GET /api/stats/:shortCode - Get URL statistics
router.get("/stats/:shortCode", async (req, res) => {
  try {
    const {shortCode} = req.params;
    if (!shortCode) {
      return res.status(400).json({
        error: "Short code is required",
      });
    }

    const urlDoc = await db.collection("urls").doc(shortCode).get();

    if (!urlDoc.exists) {
      return res.status(404).json({
        error: "Short URL not found",
      });
    }

    const urlData = urlDoc.data();

    res.status(200).json({
      shortCode: shortCode,
      originalUrl: urlData.originalUrl,
      clicks: urlData.clicks,
      createdAt: urlData.createdAt,
      lastAccessed: urlData.lastAccessed,
    });
  } catch (error) {
    console.error("Error retrieving URL stats:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// GET /api/recent - Get recently created URLs
router.get("/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const recentUrls = await db.collection("urls")
        .orderBy("createdAt", "desc")
        .limit(Math.min(limit, 50)) // Max 50
        .get();

    const urls = recentUrls.docs.map((doc) => {
      const data = doc.data();
      return {
        shortCode: doc.id,
        originalUrl: data.originalUrl,
        clicks: data.clicks,
        createdAt: data.createdAt,
        lastAccessed: data.lastAccessed || null,
      };
    });

    res.status(200).json({urls});
  } catch (error) {
    console.error("Error retrieving recent URLs:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;
