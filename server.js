// 🏠 HomeInOn Backend API — CSV-based Product Loader (with width/depth/height/room)

// CommonJS
const Fastify = require("fastify");
const cors = require("@fastify/cors");
const fs = require("fs");
const csv = require("csv-parser");

const fastify = Fastify({ logger: true });

// ✅ Enable CORS
fastify.register(cors, { origin: "*" });

// ✅ Utility: normalize/alias CSV headers into the keys your frontend expects
function normalizeRow(row = {}) {
  // Accept multiple possible header names, fall back to empty string
  const pick = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
        return String(row[k]).trim();
      }
    }
    return "";
  };

  const rawPrice = pick("price", "Price", "price_gbp", "price_cents");
  let price = rawPrice;
  // If cents, convert to pounds; else parse as float
  if (/^\d+$/.test(rawPrice) && Number(rawPrice) > 1000) {
    price = (Number(rawPrice) / 100).toFixed(2);
  } else if (!isNaN(Number(rawPrice))) {
    price = Number(rawPrice).toFixed(2);
  } else {
    price = ""; // leave blank if not numeric
  }

  return {
    // core
    sku: pick("sku", "SKU", "code", "Code"),
    title: pick("title", "Title", "name", "Name", "product_name", "Product Name"),
    price, // as a string with 2dp; frontend parses Number again safely
    image_url: pick("image_url", "Image", "base_image", "Base_image", "base image"),
    description: pick("description", "Description", "collection_description", "Collection_description"),
    colour: pick("colour", "color", "Colour", "Color"),
    material: pick("material", "Material"),
    category: pick("category", "Category", "product_kind", "Product_Kind"),

    // optional URL to product page if present
    url: pick("url", "product_url", "Product_URL", "product page", "product_page", "product_url"),

    // style (if present in CSV; frontend will derive if empty)
    style: pick("style", "Style"),

    // ✅ NEW fields you asked to expose from the CSV
    width: pick("width", "Width"),
    depth: pick("depth", "Depth"),
    height: pick("height", "Height"),
    room: pick("room", "Room"),
  };
}

// ✅ Load products from CSV
let products = [];

function loadCSV() {
  const raw = [];
  fs.createReadStream("products_clean.csv")
    .pipe(csv())
    .on("data", (data) => raw.push(data))
    .on("end", () => {
      products = raw.map(normalizeRow);
      fastify.log.info(`✅ Loaded ${products.length} products from CSV (normalized with dimensions & room)`);
    })
    .on("error", (err) => {
      fastify.log.error(`❌ CSV read error: ${err.message}`);
      products = [];
    });
}

// Load once when server starts
loadCSV();

// ✅ Root route
fastify.get("/", async () => {
  return { message: "HomeInOn API is running" };
});

// ✅ Products route
fastify.get("/products", async () => {
  return { products };
});

// ✅ Start server
fastify.listen({ port: 8080, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`✅ Server running on ${address}`);
});
