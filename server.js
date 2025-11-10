// 🏠 HomeInOn Backend API — CSV-based Product Loader (with cutout + full asset URLs)

const Fastify = require("fastify");
const cors = require("@fastify/cors");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const fastifyStatic = require("@fastify/static");

const fastify = Fastify({ logger: true });

// ✅ Enable CORS
fastify.register(cors, { origin: "*" });

// ✅ Serve static assets (so images in /assets/ work)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "assets"),
  prefix: "/assets/",
});

// 🌍 Your Render base URL — update this if your Render app name changes
const BASE_URL = "https://homeinon-backend.onrender.com";

// ✅ Normalize each row for the frontend
function normalizeRow(row = {}) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
        return String(row[k]).trim();
      }
    }
    return "";
  };

  // --- price fix
  const rawPrice = pick("price");
  let price = "";
  if (/^\d+$/.test(rawPrice) && Number(rawPrice) > 1000) {
    price = (Number(rawPrice) / 100).toFixed(2);
  } else if (!isNaN(Number(rawPrice))) {
    price = Number(rawPrice).toFixed(2);
  }

  // --- build image URLs
  const baseImage = pick("base_image");
  const cutout = pick("cutout_local_path");

  // ✅ convert relative paths → full URLs so frontend can load them
  const image_url =
    baseImage && !baseImage.startsWith("http")
      ? `${BASE_URL}/${baseImage.replace(/^\/?/, "")}`
      : baseImage;

  const cutout_local_path =
    cutout && !cutout.startsWith("http")
      ? `${BASE_URL}/${cutout.replace(/^\/?/, "")}`
      : cutout;

  return {
    sku: pick("sku"),
    title: pick("name"),
    price,
    description: pick("collection_description"),
    colour: pick("color"),
    material: pick("material"),
    category: pick("product_kind"),
    style: pick("style"),
    width: pick("width"),
    depth: pick("depth"),
    height: pick("height"),
    room: pick("room"),
    image_url, // ✅ now full URL
    cutout_local_path, // ✅ now full URL
  };
}

// ✅ Load CSV
let products = [];

function loadCSV() {
  const raw = [];
  fs.createReadStream("products_clean.csv")
    .pipe(csv())
    .on("data", (data) => raw.push(data))
    .on("end", () => {
      console.log("🧭 CSV headers:", Object.keys(raw[0] || {}));
      products = raw.map(normalizeRow);
      fastify.log.info(`✅ Loaded ${products.length} products from CSV with cutout URLs`);
    })
    .on("error", (err) => {
      fastify.log.error(`❌ CSV read error: ${err.message}`);
      products = [];
    });
}

// Load once on start
loadCSV();

// ✅ Routes
fastify.get("/", async () => ({ message: "HomeInOn API is running" }));
fastify.get("/products", async () => ({ products }));

// ✅ Start server
fastify.listen({ port: process.env.PORT || 8080, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`✅ Server running on ${address}`);
});
