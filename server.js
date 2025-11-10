// 🏠 HomeInOn Backend API — CSV-based Product Loader (with width/depth/height/room)

// CommonJS
const Fastify = require("fastify");
const cors = require("@fastify/cors");
const fs = require("fs");
const csv = require("csv-parser");

const fastify = Fastify({ logger: true });

// ✅ Enable CORS
fastify.register(cors, { origin: "*" });

// ✅ Normalize each row to frontend format
function normalizeRow(row = {}) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
        return String(row[k]).trim();
      }
    }
    return "";
  };

  const rawPrice = pick("price");
  let price = "";
  if (/^\d+$/.test(rawPrice) && Number(rawPrice) > 1000) {
    price = (Number(rawPrice) / 100).toFixed(2);
  } else if (!isNaN(Number(rawPrice))) {
    price = Number(rawPrice).toFixed(2);
  }

  return {
    sku: pick("sku"),
    title: pick("name"),
    price,
    image_url: pick("base_image"),
    description: pick("collection_description"),
    colour: pick("color"),
    material: pick("material"),
    category: pick("product_kind"),
    style: pick("style"),
    width: pick("width"),
    depth: pick("depth"),
    height: pick("height"),
    room: pick("room"),
    cutout_local_path: pick("cutout_local_path"),
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
      fastify.log.info(`✅ Loaded ${products.length} products from CSV with dimensions & room`);
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
fastify.listen({ port: 8080, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`✅ Server running on ${address}`);
});

