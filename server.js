// 🏠 HomeInOn Backend API — CSV-based Product Loader (restored + fixed mappings)

const Fastify = require("fastify");
const cors = require("@fastify/cors");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const fastifyStatic = require("@fastify/static");

const fastify = Fastify({ logger: true });

// ✅ Enable CORS for frontend and local testing
fastify.register(cors, {
  origin: [
    "https://homeinon-frontend-static.onrender.com", // your live frontend
    "http://localhost:3000"                          // for local testing
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
});

// ✅ Serve static assets (images, cutouts)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "assets"),
  prefix: "/assets/",
});

// ✅ Serve 3D models
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "models"),
  prefix: "/models/",
});



// 🌍 Base URL for Render (adjust if your backend URL changes)
const BASE_URL = "https://homeinon-backend.onrender.com";

// ✅ Normalize each CSV row to the frontend format
function normalizeRow(row = {}) {
  // Extract and clean values exactly matching your CSV headers
  const sku = (row.code || "").trim();
  const title = (row.title || "").trim();
  const priceRaw = (row.price || "").trim();
  const description = (row.description || "").trim();
  const colour = (row.colour || "").trim();
  const material = (row.material || "").trim();
  const category = (row.category || "").trim();
  const style = (row.style || "").trim();
  const room = (row.room || "").trim();

// Remove "cm", "CM", spaces, duplicates, etc.
function cleanDimension(val = "") {
  return val.replace(/cm/gi, "").trim();
}

const height = cleanDimension(row.Height || "");
const depth = cleanDimension(row.Depth || "");
const width = cleanDimension(row.Width || "");


  // Image fields
  let image_url = (row.image_url || "").trim();
  let cutout_local_path = (row.cutout_local_path || "").trim();

  // If image paths are relative, make them full URLs for Render
  if (image_url && !image_url.startsWith("http")) {
    image_url = `${BASE_URL}/${image_url.replace(/^\/?/, "")}`;
  }
  if (cutout_local_path && !cutout_local_path.startsWith("http")) {
    cutout_local_path = `${BASE_URL}/${cutout_local_path.replace(/^\/?/, "")}`;
  }

  // Normalise price
  let price = "";
  if (/^\d+$/.test(priceRaw) && Number(priceRaw) > 1000) {
    price = (Number(priceRaw) / 100).toFixed(2);
  } else if (!isNaN(Number(priceRaw))) {
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

// ✅ Load CSV data
let products = [];

function loadCSV() {
  const raw = [];

  // 🟡 DEBUG: Confirm which CSV file the server is reading
  console.log("Loaded CSV file from:", path.resolve("products_clean.csv"));

  fs.createReadStream("products_clean.csv")
    .pipe(csv())

    .on("data", (data) => raw.push(data))
    .on("end", () => {
      console.log("🧭 CSV headers:", Object.keys(raw[0] || {}));
      products = raw.map(normalizeRow);
      fastify.log.info(`✅ Loaded ${products.length} products from CSV`);
    })
    .on("error", (err) => {
      fastify.log.error(`❌ CSV read error: ${err.message}`);
      products = [];
    });
}

// Load once on startup
loadCSV();

// ✅ Routes
fastify.get("/", async () => ({ message: "HomeInOn API is running" }));
fastify.get("/products", async () => ({ products }));

// ✅ Start server (Render-compatible)
fastify.listen({ port: process.env.PORT || 8080, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`✅ Server running on ${address}`);
});
