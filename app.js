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
   ⭐ GEMINI AI ENDPOINT — DIRECT HTTP CALL (NO CLIENT)
---------------------------------------------------- */
fastify.post("/ai-gemini", async (req, reply) => {
  const userQuery = (req.body && req.body.query) || "";
  if (!userQuery) return reply.send({ categories: [] });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    // NOTE: v1 endpoint + gemini-1.5-flash model
const url =
  `https://generativelanguage.googleapis.com/v1/models/` +
  `models/gemini-2.5-flash:generateContent?key=${apiKey}`;


    const prompt = `
You are an expert interior-design classifier.

TASK:
- Extract ONLY furniture categories mentioned by the user.
- Return ONLY a JSON object.
- If multiple items are mentioned, return ALL.

Valid categories include:
["bed", "wardrobe", "dressing table", "drawer", "bedside table",
 "coffee table", "sofa", "mirror", "sideboard", "bench",
 "dining table", "dining chair", "tv unit", "cabinet", "desk",
 "armchair", "bookcase"]

USER QUERY:
"${userQuery}"

Return ONLY JSON, EXACTLY like:
{ "categories": ["wardrobe", "dressing table", "mirror"] }
    `.trim();

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini HTTP error:", res.status, errText);
      return reply.status(500).send({
        error: "Gemini API HTTP failed",
        categories: []
      });
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    let json;
    try {
      json = JSON.parse(
        text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()
      );
    } catch (e) {
      console.error("JSON parse error on Gemini text:", text);
      json = { categories: [] };
    }

    return reply.send(json);
  } catch (err) {
    console.error("Gemini AI Error (HTTP):", err);
    return reply.status(500).send({
      error: "Gemini AI failed",
      categories: []
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
