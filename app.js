// 🏠 HomeInOn Backend API — CLEAN VERSION (NO GEMINI)

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

const fastify = Fastify({ logger: true });

/* ----------------------------------------------------
   JSON BODY PARSER
---------------------------------------------------- */
fastify.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  function (_, body, done) {
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      done(err);
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
    .on("error", (err) => console.error("CSV error:", err));
}
loadCSV();

/* ----------------------------------------------------
   ROUTES
---------------------------------------------------- */
fastify.get("/", async () => ({ message: "HomeInOn API running" }));
fastify.get("/products", async () => ({ products }));

/* ----------------------------------------------------
   DEBUG: MODEL LIST (still safe to keep, even if unused)
---------------------------------------------------- */
fastify.get("/ai-models", async (req, reply) => {
  return reply.send({
    message: "Gemini disabled — no models available (using WebLLM instead)."
  });
});

/* ----------------------------------------------------
   FALLBACK CATEGORY EXTRACTOR (keyword matching)
---------------------------------------------------- */
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
    if (regex.test(lowerQuery)) detected.push(category);
  }

  return detected.length > 0 ? detected : ["sofa", "bed", "dining table"];
}

/* ----------------------------------------------------
   AI ENDPOINT — NOW FALLBACK ONLY (no Gemini)
---------------------------------------------------- */
fastify.post("/ai-gemini", async (req, reply) => {
  const userQuery = (req.body && req.body.query) || "";

  if (!userQuery) {
    return reply.send({
      categories: [],
      room: null,
      confidence: "none",
      source: "no_query"
    });
  }

  const categories = fallbackCategoryExtraction(userQuery);

  return reply.send({
    categories,
    room: null,
    confidence: "fallback",
    source: "keyword_matching_backend",
    message: "Gemini disabled — frontend now uses WebLLM."
  });
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
