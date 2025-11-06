// 🏠 HomeInOn Backend API (CommonJS version)
// Run this file with: node server.js

const Fastify = require("fastify");
const cors = require("@fastify/cors");

const fastify = Fastify({ logger: true });

// ✅ Enable CORS so frontend can connect
fastify.register(cors, { origin: "*" });

// ✅ Test route
fastify.get("/", async (request, reply) => {
  return { message: "HomeInOn API is running" };
});

// ✅ Products route with 20 sample entries
fastify.get("/products", async (request, reply) => {
  return {
    products: [
      { title: "Modern Oak Bed", category: "furniture", price_cents: 79900, image_url: "https://placehold.co/320x240/EEE/333?text=Oak+Bed", style: "modern" },
      { title: "Boho Rattan Chair", category: "furniture", price_cents: 12900, image_url: "https://placehold.co/320x240/F9E4B7/333?text=Rattan+Chair", style: "boho" },
      { title: "Scandi Coffee Table", category: "furniture", price_cents: 17900, image_url: "https://placehold.co/320x240/FFFBEA/333?text=Scandi+Table", style: "scandi" },
      { title: "Industrial Metal Lamp", category: "lighting", price_cents: 8900, image_url: "https://placehold.co/320x240/C5C6C7/333?text=Metal+Lamp", style: "industrial" },
      { title: "Boho Woven Rug", category: "decor", price_cents: 15900, image_url: "https://placehold.co/320x240/F4E1C1/333?text=Woven+Rug", style: "boho" },
      { title: "Modern Glass Mirror", category: "mirrors", price_cents: 10900, image_url: "https://placehold.co/320x240/ECECEC/333?text=Glass+Mirror", style: "modern" },
      { title: "Industrial Floor Lamp", category: "lighting", price_cents: 12900, image_url: "https://placehold.co/320x240/B8B8B8/333?text=Floor+Lamp", style: "industrial" },
      { title: "Scandi Wall Shelf", category: "decor", price_cents: 6900, image_url: "https://placehold.co/320x240/FFF5E4/333?text=Wall+Shelf", style: "scandi" },
      { title: "Boho Macrame Hanger", category: "decor", price_cents: 4900, image_url: "https://placehold.co/320x240/F8E1D4/333?text=Macrame+Hanger", style: "boho" },
      { title: "Modern Grey Sofa", category: "furniture", price_cents: 49900, image_url: "https://placehold.co/320x240/DCDCDC/333?text=Grey+Sofa", style: "modern" },
      { title: "Industrial Pipe Shelf", category: "decor", price_cents: 7800, image_url: "https://placehold.co/320x240/A9A9A9/333?text=Pipe+Shelf", style: "industrial" },
      { title: "Scandi Pendant Light", category: "lighting", price_cents: 11900, image_url: "https://placehold.co/320x240/F9F9F9/333?text=Pendant+Light", style: "scandi" },
      { title: "Boho Wicker Basket", category: "decor", price_cents: 5900, image_url: "https://placehold.co/320x240/ECD5B9/333?text=Wicker+Basket", style: "boho" },
      { title: "Modern Minimal Lamp", category: "lighting", price_cents: 9900, image_url: "https://placehold.co/320x240/EFEFEF/333?text=Minimal+Lamp", style: "modern" },
      { title: "Industrial Clock", category: "decor", price_cents: 8800, image_url: "https://placehold.co/320x240/B0B0B0/333?text=Industrial+Clock", style: "industrial" },
      { title: "Scandi Linen Curtains", category: "decor", price_cents: 14900, image_url: "https://placehold.co/320x240/F2F2F2/333?text=Linen+Curtains", style: "scandi" },
      { title: "Boho Bamboo Lamp", category: "lighting", price_cents: 11900, image_url: "https://placehold.co/320x240/F5E6CC/333?text=Bamboo+Lamp", style: "boho" },
      { title: "Modern Marble Table", category: "furniture", price_cents: 89900, image_url: "https://placehold.co/320x240/EEE/333?text=Marble+Table", style: "modern" },
      { title: "Scandi Armchair", category: "furniture", price_cents: 24900, image_url: "https://placehold.co/320x240/FFF9F2/333?text=Armchair", style: "scandi" },
      { title: "Industrial Leather Stool", category: "furniture", price_cents: 16900, image_url: "https://placehold.co/320x240/BBB/333?text=Leather+Stool", style: "industrial" }
    ]
  };
});

// ✅ Start server
fastify.listen({ port: 8080, host: "0.0.0.0" }, (err, address) => {

  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`✅ Server running on ${address}`);
});
