// 🏠 HomeInOn Backend API — GEMINI VERSION (FINAL CLEAN)
// -----------------------------------------------------
require("dotenv").config();

const Fastify = require("fastify");
const cors = require("@fastify/cors");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const fastifyStatic = require("@fastify/static");

// -----------------------------------------------------
// ⭐ GOOGLE GEMINI CLIENT (FREE TIER AVAILABLE)
// -----------------------------------------------------
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const fastify = Fastify({ logger: true });

// CORS
fastify.register(cors, {
  origin: [
    "https://homeinon-frontend-static.onrender.com",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true
});

// STATIC FILES
fastify.register(fastifyStatic, {
  root: [
    path.join(__dirname, "assets"),
    path.join(__dirname, "models")
  ],
  prefix: "/",
});

// BASE URL
const BASE_URL = "https://homeinon-backend.onrender.com";

// HELPERS
function cleanDimension(v = "") {
  return v.replace(/cm/gi, "").trim();
}

function normalizeRow(row = {}) {
  const sku = (row.code || "").trim();
  const title = (row.title || "").trim();
  const priceRaw = (row.price || "").trim();
  const description = (row.description || "").trim();
  const colour = (row.colour || "").trim();
  const material = (row.material || "").trim();
  const category = (row.category || "").trim();
  const style = (row.style || "").trim();
  const room = (row.room || "").trim();

  const height = cleanDimension(row.Height || "");
  const depth = cleanDimension(row.Depth || "");
  const width = cleanDimension(row.Width || "");

  let image_url = (row.image_url || "").trim();
  let cutout_local_path = (row.cutout_local_path || "").trim();

  if (image_url && !image_url.startsWith("http")) {
    image_url = `${BASE_URL}/${image_url.replace(/^\/?/, "")}`;
  }
  if (cutout_local_path && !cutout_local_path.startsWith("http")) {
    cutout_local_path = `${BASE_URL}/${cutout_local_path.replace(/^\/?/, "")}`;
  }

  let price = "";
  if (!isNaN(Number(priceRaw))) {
    price = Number(priceRaw).toFixed(2);
  }

  return {
    sku,
    title,
    price,
    description,
    colour,
    material,
    category,
    style,
    room,
    width,
    depth,
    height,
    image_url,
    cutout_local_path,
  };
}

// CSV LOAD
let products = [];
function loadCSV() {
  const raw = [];
  console.log("Loading CSV...");

  fs.createReadStream("products_clean.csv")
    .pipe(csv())
    .on("data", (data) => raw.push(data))
    .on("end", () => {
      products = raw.map(normalizeRow);
      console.log(`✅ Loaded ${products.length} products`);
    })
    .on("error", (err) => {
      console.error("❌ CSV Load Error:", err);
      products = [];
    });
}
loadCSV();

// ROUTES
fastify.get("/", async () => ({ message: "HomeInOn API running" }));
fastify.get("/products", async () => ({ products }));

// ----------------------------------------------------------
// ⭐ AI ENDPOINT — GEMINI 1.5 FLASH (FREE TIER)
// ----------------------------------------------------------
fastify.post("/ai-suggest", async (req, reply) => {
  const userQuery = req.body.query || "";

  if (!userQuery) {
    return reply.send({ categories: [] });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
      You are an AI assistant. 
      Extract furniture categories from the user description.
      Return ONLY valid JSON like:
      { "categories": ["bed", "wardrobe"] }

      User: ${userQuery}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      json = { categories: [] }; // fallback
    }

    return reply.send(json);

  } catch (err) {
    console.error("Gemini Error:", err);
    return reply.status(500).send({
      error: "AI request failed",
      categories: []
    });
  }
});

// START SERVER
fastify.listen(
  { port: process.env.PORT || 8080, host: "0.0.0.0" },
  (err, address) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    console.log(`✅ Server running at ${address}`);
  }
);
