// 🏠 HomeInOn Backend API — GEMINI VERSION (FINAL CLEAN)
require("dotenv").config();

const Fastify = require("fastify");
const cors = require("@fastify/cors");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const fastifyStatic = require("@fastify/static");

// ⭐ GOOGLE GEMINI (CommonJS)
const { GoogleGenerativeAI } = require("@google/generative-ai");

// IMPORTANT — must match Render environment key name
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const fastify = Fastify({ logger: true });

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
    image_url: `${BASE_URL}/${(row.image_url || "").replace(/^\/?/, "")}`,
    cutout_local_path: `${BASE_URL}/${(row.cutout_local_path || "").replace(/^\/?/, "")}`
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
   ⭐ GEMINI AI ENDPOINT
---------------------------------------------------- */
fastify.post("/ai-gemini", async (req, reply) => {
  const userQuery = req.body.query || "";

  if (!userQuery) return reply.send({ categories: [] });

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest"
    });

    const prompt = `
You are an interior design engine.
User request: "${userQuery}"

Return ONLY valid JSON like this:
{ "categories": ["bed", "wardrobe"] }
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { categories: [] };
    }

    return reply.send(json);

  } catch (err) {
    console.error("Gemini AI Error:", err);
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
