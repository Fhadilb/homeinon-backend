// 🏠 HomeInOn Backend API — CSV-based Product Loader

const Fastify = require("fastify");
const cors = require("@fastify/cors");
const fs = require("fs");
const csv = require("csv-parser");

const fastify = Fastify({ logger: true });

// ✅ Enable CORS
fastify.register(cors, { origin: "*" });

// ✅ Load products from CSV
let products = [];

function loadCSV() {
  const results = [];
  fs.createReadStream("products_clean.csv")
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      products = results;
      fastify.log.info(`✅ Loaded ${products.length} products from CSV`);
    });
}

// Load once when server starts
loadCSV();

// ✅ Root route
fastify.get("/", async (request, reply) => {
  return { message: "HomeInOn API is running" };
});

// ✅ Products route
fastify.get("/products", async (request, reply) => {
  return { products };
});

// ✅ Start server
fastify.listen({ port: 8080, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`✅ Server running on ${address}`);
  // updated for CSV
});
