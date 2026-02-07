const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Debug: check if API key is loaded
console.log(
  "API Key loaded:",
  process.env.GEOAPIFY_API_KEY
    ? `"${process.env.GEOAPIFY_API_KEY.substring(0, 8)}..."`
    : "UNDEFINED! Check your .env file"
);

// Allow frontend to make requests to this server
app.use(cors());

// Health check route
app.get("/", (req, res) => {
  res.json({ status: "Cafe Finder API is running ☕" });
});

// Main route: search for cafes near a location
app.get("/api/cafes", async (req, res) => {
  const { lat, lng, radius } = req.query;

  // Validate required parameters
  if (!lat || !lng) {
    return res
      .status(400)
      .json({ error: "lat and lng query parameters are required" });
  }

  try {
    const searchRadius = radius || 1500; // Default 1.5km radius

    // Geoapify Places API - search for cafes
    const url =
      `https://api.geoapify.com/v2/places?` +
      `categories=catering.cafe,catering.cafe.coffee_shop,catering.cafe.coffee&` +
      `filter=circle:${lng},${lat},${searchRadius}&` +
      `limit=15&` +
      `apiKey=${process.env.GEOAPIFY_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Geoapify API error:", response.status, errorText);
      return res.status(response.status).json({
        error: "Failed to fetch from Geoapify",
        details: errorText,
      });
    }

    const data = await response.json();

    // Transform the data to match our frontend format
    const cafes = (data.features || []).map((feature) => {
      const p = feature.properties;
      return {
        name: p.name || "Unnamed Cafe",
        address:
          p.formatted ||
          p.address_line2 ||
          p.street ||
          "Address not available",
        lat: p.lat,
        lng: p.lon,
        rating: null, // Geoapify free tier doesn't include ratings
        category: p.categories?.[0]?.split(".")?.[1] || "Cafe",
        isOpen: p.opening_hours ? null : null,
        photo: null, // No photos in free tier
      };
    });

    console.log(`Found ${cafes.length} cafes near ${lat}, ${lng}`);
    res.json({ cafes, count: cafes.length });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});