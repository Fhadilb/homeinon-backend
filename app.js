// 🏠 HomeInOn Backend API — GEMINI VERSION (FINAL CLEAN)
// force new deploy 2025-11-26

require("dotenv").config();

const Fastify = require("fastify");
const cors = require("@fastify/cors");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const fastifyStatic = require("@fastify/static");

// Use node-fetch via dynamic import (because v3 is ESM-only)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// ⭐ GOOGLE GEMINI (we will stop using the client below, but leaving this for now)
const { GoogleGenerativeAI } = require("@google/generative-ai");

// IMPORTANT — must match Render environment key name
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


const fastify = Fastify({ logger: true });

/* ----------------------------------------------------
   FIX: JSON BODY PARSER (REQUIRED FOR RENDER)
---------------------------------------------------- */
fastify.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  function (_, body, done) {
    try {
      const json = JSON.parse(body);
      done(null, json);
    } catch (err) {
      done(err, undefined);
    }
  }
);


/* ----------------------------------------------------
   CORS
---------------------------------------------------- */
fastify.register(cors, {
  origin: [
    "https://homeinon-frontend-static.onrender.com",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true
});

/* ----------------------------------------------------
   STATIC FILES
---------------------------------------------------- */
fastify.register(fastifyStatic, {
  root: [
    path.join(__dirname, "assets"),
    path.join(__dirname, "models")
  ],
  prefix: "/",
});

/* ----------------------------------------------------
   HELPERS
---------------------------------------------------- */
const BASE_URL = "https://homeinon-backend.onrender.com";

function cleanDimension(v = "") {
  return v.replace(/cm/gi, "").trim();
}

function normalizeRow(row = {}) {
  const rawImage = (row.image_url || "").trim();
  const rawCutout = (row.cutout_local_path || "").trim();

  // Detect absolute URL
  const isFullURL = (url) => /^https?:\/\//i.test(url);

  return {
    sku: (row.code || "").trim(),
    title: (row.title || "").trim(),
    price: Number(row.price || 0).toFixed(2),
    description: (row.description || "").trim(),
    colour: (row.colour || "").trim(),
    material: (row.material || "").trim(),
    category: (row.category || "").trim(),
    style: (row.style || "").trim(),
    room: (row.room || "").trim(),
    height: cleanDimension(row.Height || ""),
    depth: cleanDimension(row.Depth || ""),
    width: cleanDimension(row.Width || ""),

    // ⭐ FIXED: Keep full URLs, else prepend your backend
    image_url: isFullURL(rawImage)
      ? rawImage
      : `${BASE_URL}/${rawImage.replace(/^\/?/, "")}`,

    cutout_local_path: isFullURL(rawCutout)
      ? rawCutout
      : `${BASE_URL}/${rawCutout.replace(/^\/?/, "")}`
  };
}




/* ----------------------------------------------------
   LOAD CSV
---------------------------------------------------- */
let products = [];
function loadCSV() {
  const raw = [];
  console.log("Loading CSV...");

  fs.createReadStream("products_clean.csv")
    .pipe(csv())
    .on("data", (d) => raw.push(d))
    .on("end", () => {
      products = raw.map(normalizeRow);
      console.log(`✅ Loaded ${products.length} products`);
    })
    .on("error", (err) => {
      console.error("CSV error:", err);
    });
}

loadCSV();

/* ----------------------------------------------------
   ROUTES
---------------------------------------------------- */
fastify.get("/", async () => ({ message: "HomeInOn API running" }));
fastify.get("/products", async () => ({ products }));

/* ----------------------------------------------------
   DEBUG ROUTE — LIST GOOGLE GEMINI MODELS VIA HTTP
   Visit: https://homeinon-backend.onrender.com/ai-models
---------------------------------------------------- */
fastify.get("/ai-models", async (req, reply) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    // 👉 IMPORTANT: use v1beta here
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    console.log("📌 AVAILABLE GEMINI MODELS:", JSON.stringify(data, null, 2));
    return reply.send(data);
  } catch (err) {
    console.error("❌ MODEL LIST ERROR:", err);
    return reply.status(500).send({ error: "Failed to list models" });
  }
});


/* ----------------------------------------------------
   ⭐ GEMINI AI ENDPOINT — USING EXISTING CLIENT
---------------------------------------------------- */

// Add this helper function before your route
function fallbackCategoryExtraction(query) {
  const lowerQuery = query.toLowerCase();
  const categoryMap = {
    bed: /\b(bed|beds)\b/,
    wardrobe: /\b(wardrobe|wardrobes|closet)\b/,
    sofa: /\b(sofa|sofas|couch|settee)\b/,
    desk: /\b(desk|desks)\b/,
    "dining table": /\b(dining table|dining tables)\b/,
    "coffee table": /\b(coffee table|coffee tables)\b/,
    mirror: /\b(mirror|mirrors)\b/,
    bookcase: /\b(bookcase|bookcases|shelves|shelving)\b/,
    drawer: /\b(drawer|drawers|chest of drawers)\b/,
    cabinet: /\b(cabinet|cabinets)\b/,
    "tv unit": /\b(tv unit|tv stand|tv units)\b/,
    "bedside table": /\b(bedside table|nightstand)\b/,
    "dining chair": /\b(dining chair|dining chairs)\b/,
    armchair: /\b(armchair|armchairs)\b/
  };

  const detected = [];
  for (const [category, regex] of Object.entries(categoryMap)) {
    if (regex.test(lowerQuery)) {
      detected.push(category);
    }
  }

  return detected.length > 0 ? detected : ["sofa", "bed", "dining table"];
}

fastify.post("/ai-gemini", async (req, reply) => {
  const userQuery = (req.body && req.body.query) || "";
  if (!userQuery) {
    return reply.send({ 
      categories: [], 
      room: null, 
      confidence: "none" 
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    // Use the existing GoogleGenerativeAI client
    const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 256,
      }
    });

    const prompt = `
You are a precise furniture category classifier for an e-commerce product database.

USER QUERY: "${userQuery}"

TASK: Extract furniture categories and optional room type from the user's query.

VALID CATEGORIES (return ONLY from this list):
- bed, wardrobe, dressing table, drawer, bedside table
- coffee table, sofa, mirror, sideboard, bench
- dining table, dining chair, tv unit, cabinet, desk
- armchair, bookcase

SYNONYM MAPPINGS (auto-convert these):
- "dresser" OR "chest" → "sideboard"
- "chest of drawers" OR "drawers" → "drawer"
- "nightstand" → "bedside table"
- "couch" OR "settee" → "sofa"
- "shelves" OR "shelving" → "bookcase"
- "tv stand" → "tv unit"

ROOM FILTERING (if user mentions a room):
- bedroom: bed, wardrobe, dressing table, bedside table, drawer, mirror
- living room: sofa, coffee table, armchair, tv unit, sideboard, bookcase, mirror
- dining room: dining table, dining chair, sideboard, bench, cabinet
- office: desk, bookcase, cabinet, armchair
- hallway: mirror, bench, cabinet

STRICT RULES:
1. Return ONLY categories that match the user's intent
2. If a room is mentioned, filter categories to room-appropriate items
3. NO duplicates, NO invalid categories
4. If ambiguous, return most likely 2-3 categories max
5. Return valid JSON ONLY, no markdown

OUTPUT FORMAT:
{
  "categories": ["category1", "category2"],
  "room": "bedroom",
  "confidence": "high"
}

EXAMPLES:
Query: "I need furniture for my office under £1000"
Output: {"categories": ["desk", "bookcase", "cabinet"], "room": "office", "confidence": "high"}

Query: "blue bedroom furniture"
Output: {"categories": ["bed", "wardrobe", "bedside table"], "room": "bedroom", "confidence": "medium"}

Query: "sofa"
Output: {"categories": ["sofa"], "room": null, "confidence": "high"}

Now process the user query above. Return ONLY the JSON object, no markdown blocks.
`.trim();

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    console.log("🤖 Gemini raw response:", text);

    // Clean response (remove markdown code blocks)
    const cleanText = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    let json;
    try {
      json = JSON.parse(cleanText);
      
      // Validate response structure
      if (!json.categories || !Array.isArray(json.categories)) {
        throw new Error("Invalid response structure");
      }

      // Ensure categories are valid
      const validCategories = [
        "bed", "wardrobe", "dressing table", "drawer", "bedside table",
        "coffee table", "sofa", "mirror", "sideboard", "bench",
        "dining table", "dining chair", "tv unit", "cabinet", "desk",
        "armchair", "bookcase"
      ];

      json.categories = json.categories.filter(cat => 
        validCategories.includes(cat.toLowerCase())
      );

      // If AI returned nothing valid, use fallback
      if (json.categories.length === 0) {
        console.log("⚠️ AI returned no valid categories, using fallback");
        json.categories = fallbackCategoryExtraction(userQuery);
        json.confidence = "fallback";
        json.source = "keyword_matching";
      }

      console.log("✅ Final response:", json);
      return reply.send(json);

    } catch (parseErr) {
      console.error("❌ JSON parse error. Raw text:", text);
      console.error("Parse error details:", parseErr.message);
      
      // Fallback to keyword matching
      const fallbackCategories = fallbackCategoryExtraction(userQuery);
      return reply.send({
        categories: fallbackCategories,
        room: null,
        confidence: "fallback",
        source: "keyword_matching",
        debug: { rawText: text, error: parseErr.message }
      });
    }

  } catch (err) {
    console.error("❌ Gemini AI Error:", err);
    
    // Final fallback
    const fallbackCategories = fallbackCategoryExtraction(userQuery);
    return reply.send({
      categories: fallbackCategories,
      room: null,
      confidence: "fallback",
      source: "keyword_matching",
      error: err.message
    });
  }
});



/* ----------------------------------------------------
   START SERVER
---------------------------------------------------- */
fastify.listen(
  { port: process.env.PORT || 8080, host: "0.0.0.0" },
  (err, addr) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    console.log(`✅ Server running at ${addr}`);
  }
);
