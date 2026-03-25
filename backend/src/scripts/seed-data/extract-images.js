#!/usr/bin/env node
/**
 * Extract all ecommerce image URLs from tailwindplus-components.json
 * and map them to existing products in tailwindui-products.json
 *
 * Usage: node extract-images.js
 */

const fs = require("fs");
const path = require("path");

const COMPONENTS_PATH = path.resolve(
  __dirname,
  "../../../../Resources/TailwindUI/tailwindplus-components.json",
);
const SEED_DATA_PATH = path.resolve(__dirname, "tailwindui-products.json");

// Generous path - try relative to CrowCommerce root too
const ALT_COMPONENTS_PATH =
  "/Users/itsjusteric/CrowCommerce/Resources/TailwindUI/tailwindplus-components.json";

console.log(
  "🔍 Phase 1: Extracting all image URLs from TailwindUI components...\n",
);

let componentsPath = fs.existsSync(COMPONENTS_PATH)
  ? COMPONENTS_PATH
  : ALT_COMPONENTS_PATH;
if (!fs.existsSync(componentsPath)) {
  console.error(
    "Cannot find tailwindplus-components.json at:\n  " +
      COMPONENTS_PATH +
      "\n  " +
      ALT_COMPONENTS_PATH,
  );
  process.exit(1);
}

const raw = fs.readFileSync(componentsPath, "utf8");
const components = JSON.parse(raw);

// ─── Extract all ecommerce image URLs with their surrounding context ─────────
const allImageUrls = new Set();
const imageContextMap = new Map(); // url -> [{componentName, surroundingText}]

function extractFromCode(code, componentName) {
  // Find all ecommerce image URLs
  const urlRegex =
    /https?:\/\/tailwindcss\.com\/plus-assets\/img\/ecommerce-images\/[^\s"'`)\]},]+/g;
  const matches = code.match(urlRegex) || [];

  matches.forEach((url) => {
    // Clean trailing punctuation
    url = url.replace(/['")\]},;]+$/, "");
    allImageUrls.add(url);

    if (!imageContextMap.has(url)) imageContextMap.set(url, []);

    // Get surrounding context (100 chars around the URL) for product name detection
    const idx = code.indexOf(url);
    const context = code.substring(
      Math.max(0, idx - 300),
      idx + url.length + 300,
    );
    imageContextMap.get(url).push({ componentName, context });
  });
}

function walkComponents(obj, path = "") {
  if (!obj || typeof obj !== "object") return;

  if (typeof obj === "string" && obj.includes("ecommerce-images")) {
    extractFromCode(obj, path);
    return;
  }

  // Check for code/snippet content
  if (obj.code && typeof obj.code === "string") {
    extractFromCode(obj.code, path);
  }

  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string" && val.includes("ecommerce-images")) {
      extractFromCode(val, path + "." + key);
    } else if (typeof val === "object" && val !== null) {
      walkComponents(val, path + "." + key);
    }
  }
}

walkComponents(components);

console.log(`Found ${allImageUrls.size} unique ecommerce image URLs\n`);

// ─── Categorize images by URL pattern ─────────────────────────────────────────
const categories = {};
allImageUrls.forEach((url) => {
  const filename = url.split("/").pop();
  const match = filename.match(/^([a-z-]+?)-(\d+)/);
  if (match) {
    const cat = match[1];
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(url);
  }
});

console.log("Image categories:");
Object.entries(categories)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([cat, urls]) => {
    console.log(`  ${cat}: ${urls.length} images`);
  });

// ─── Phase 2: Extract product-to-image mappings from product page components ──
console.log("\n🔍 Phase 2: Mapping images to products...\n");

// Known product names from TailwindUI components (gleaned from the JSX)
const productNamePatterns = {
  "basic-tee": ["Basic Tee", "basic tee"],
  "zip-tote-basket": ["Zip Tote Basket", "zip tote basket", "Zip Tote"],
  "high-wall-tote": ["High Wall Tote", "high wall tote"],
  "nomad-tumbler": ["Nomad Tumbler", "nomad tumbler"],
  "artwork-tee": ["Artwork Tee", "artwork tee"],
  "throwback-hip-bag": ["Throwback Hip Bag", "throwback hip bag"],
  "micro-backpack": ["Micro Backpack", "micro backpack"],
  "machined-pen": ["Machined Pen", "machined pen"],
  "earthen-bottle": ["Earthen Bottle", "earthen bottle"],
  "earthen-mug": ["Earthen Mug", "earthen mug"],
  "nomad-pouch": ["Nomad Pouch", "nomad pouch"],
  "medium-stuff-satchel": ["Medium Stuff Satchel", "medium stuff satchel"],
  "focus-carry-pouch": ["Focus Carry Pouch", "focus carry pouch"],
  "leatherbound-daily-journal": [
    "Leatherbound Daily Journal",
    "leatherbound daily journal",
  ],
  "cold-brew-bottle": ["Cold Brew Bottle", "cold brew bottle"],
  "minimalist-wristwatch": ["Minimalist Wristwatch", "minimalist wristwatch"],
  "billfold-wallet": ["Billfold Wallet", "billfold wallet"],
  "carry-clutch": ["Carry Clutch", "carry clutch"],
  "small-stuff-satchel": ["Small Stuff Satchel", "small stuff satchel"],
  "flap-stuff-satchel": ["Flap Stuff Satchel", "flap stuff satchel"],
  "wrap-clutch": ["Wrap Clutch", "wrap clutch"],
};

// For each image, try to detect which product it belongs to by examining context
const productImages = new Map(); // handle -> Set<url>

// Initialize with existing seed data
const seedData = JSON.parse(fs.readFileSync(SEED_DATA_PATH, "utf8"));
seedData.products.forEach((p) => {
  const urls = new Set();
  if (p.thumbnail) urls.add(p.thumbnail);
  if (p.images)
    p.images.forEach((img) => {
      if (typeof img === "string") urls.add(img);
      else if (img?.url) urls.add(img.url);
    });
  productImages.set(p.handle, urls);
});

// Now scan contexts to find product associations
imageContextMap.forEach((contexts, url) => {
  contexts.forEach(({ context }) => {
    // Try to match product names in the surrounding context
    for (const [handle, names] of Object.entries(productNamePatterns)) {
      for (const name of names) {
        if (context.includes(name)) {
          if (!productImages.has(handle)) productImages.set(handle, new Set());
          productImages.get(handle).add(url);
          break;
        }
      }
    }
  });
});

// ─── Phase 3: Smart URL pattern matching ──────────────────────────────────────
// Product page images often follow patterns like product-page-XX-product-YY.jpg
// or product-page-XX-related-product-YY.jpg
// Group product page images by their page number (same page = same product usually)

const productPageGroups = {};
allImageUrls.forEach((url) => {
  const match = url.match(/product-page-(\d+)-(product|featured|related)/);
  if (match) {
    const pageNum = match[1];
    const type = match[2];
    const key = `pp-${pageNum}-${type}`;
    if (!productPageGroups[key]) productPageGroups[key] = [];
    productPageGroups[key].push(url);
  }
});

console.log("Product page image groups:");
Object.entries(productPageGroups).forEach(([key, urls]) => {
  console.log(`  ${key}: ${urls.length} images`);
  urls.forEach((u) => console.log(`    ${u.split("/").pop()}`));
});

// ─── Phase 4: Also look for image arrays in JSX code ──────────────────────────
// Product detail components often have arrays like:
//   images: [{src: '...', alt: '...'}, ...]
// or
//   <img src="..." /> repeated in gallery sections

console.log("\n🔍 Phase 3: Looking for gallery arrays in component code...\n");

const galleryProducts = {};

function findGalleries(obj, componentPath = "") {
  if (!obj || typeof obj !== "object") return;

  for (const [key, val] of Object.entries(obj)) {
    if (
      typeof val === "string" &&
      val.includes("ecommerce-images") &&
      val.includes("images")
    ) {
      // Look for image array patterns
      // Pattern 1: images: [ { src: '...', ... }, ... ]
      const imageArrayRegex = /images\s*[=:]\s*\[([^\]]{50,})\]/g;
      let match;
      while ((match = imageArrayRegex.exec(val)) !== null) {
        const arrayContent = match[1];
        const imgUrls = [];
        const urlMatches = arrayContent.match(
          /https?:\/\/tailwindcss\.com\/plus-assets\/img\/ecommerce-images\/[^\s"'`)\]},]+/g,
        );
        if (urlMatches && urlMatches.length > 1) {
          // Find which product this gallery belongs to
          const nearbyText = val.substring(
            Math.max(0, match.index - 500),
            match.index,
          );
          let productHandle = null;

          for (const [handle, names] of Object.entries(productNamePatterns)) {
            for (const name of names) {
              if (
                nearbyText.includes(name) ||
                val.substring(match.index, match.index + 500).includes(name)
              ) {
                productHandle = handle;
                break;
              }
            }
            if (productHandle) break;
          }

          const cleanUrls = urlMatches.map((u) =>
            u.replace(/['")\]},;]+$/, ""),
          );
          galleryProducts[productHandle || componentPath] = cleanUrls;
        }
      }

      // Pattern 2: product: { ... images: [ ... ] }
      const productBlockRegex =
        /(?:name|title)\s*:\s*['"]([^'"]+)['"]\s*,[\s\S]{0,500}?images\s*:\s*\[([^\]]+)\]/g;
      while ((match = productBlockRegex.exec(val)) !== null) {
        const productName = match[1];
        const imagesBlock = match[2];
        const urls = imagesBlock.match(
          /https?:\/\/tailwindcss\.com\/plus-assets\/img\/ecommerce-images\/[^\s"'`)\]},]+/g,
        );
        if (urls && urls.length > 1) {
          const cleanUrls = urls.map((u) => u.replace(/['")\]},;]+$/, ""));

          // Find matching handle
          let foundHandle = null;
          for (const p of seedData.products) {
            if (
              p.title.toLowerCase() === productName.toLowerCase() ||
              productName.toLowerCase().includes(p.title.toLowerCase())
            ) {
              foundHandle = p.handle;
              break;
            }
          }

          galleryProducts[foundHandle || productName] = cleanUrls;
        }
      }
    }

    if (typeof val === "object" && val !== null) {
      findGalleries(val, componentPath + "." + key);
    }
  }
}

findGalleries(components);

console.log("Gallery arrays found:");
Object.entries(galleryProducts).forEach(([product, urls]) => {
  console.log(`  ${product}: ${urls.length} images`);
  urls.forEach((u) => console.log(`    ${u.split("/").pop()}`));
});

// ─── Phase 5: Merge all findings into product images ──────────────────────────
console.log("\n🔍 Phase 4: Merging results...\n");

// Add gallery findings to product images
for (const [handle, urls] of Object.entries(galleryProducts)) {
  if (productImages.has(handle)) {
    urls.forEach((u) => productImages.get(handle).add(u));
  }
}

// ─── Phase 6: Smart assignment of unassigned product-page images ──────────────
// Use the product page context to assign unclaimed images to similar products

// Group all available ecommerce images by broad category
const availableByType = {
  product: [], // product-page-*-product-*.jpg
  category: [], // category-page-*.jpg
  checkout: [], // checkout-*.jpg
  confirmation: [], // confirmation-*.jpg
  cart: [], // shopping-cart-*.jpg
  home: [], // home-page-*.jpg
  order: [], // order-history-*.jpg, order-summary-*.jpg
  hero: [], // product-page-*-hero*.jpg
  feature: [], // product-page-*-feature*.jpg, product-feature-*.jpg
};

allImageUrls.forEach((url) => {
  const fn = url.split("/").pop();
  if (fn.match(/product-page-\d+-product/)) availableByType.product.push(url);
  else if (fn.match(/category-page/)) availableByType.category.push(url);
  else if (fn.match(/checkout/)) availableByType.checkout.push(url);
  else if (fn.match(/confirmation/)) availableByType.confirmation.push(url);
  else if (fn.match(/shopping-cart/)) availableByType.cart.push(url);
  else if (fn.match(/home-page/)) availableByType.home.push(url);
  else if (fn.match(/order/)) availableByType.order.push(url);
  else if (fn.match(/hero/)) availableByType.hero.push(url);
  else if (fn.match(/feature/)) availableByType.feature.push(url);
});

// Collect all URLs already assigned to a product
const assignedUrls = new Set();
productImages.forEach((urls) => urls.forEach((u) => assignedUrls.add(u)));

// Get unassigned product-relevant images (not hero/nav/feature type)
const unassigned = [...allImageUrls].filter((url) => {
  if (assignedUrls.has(url)) return false;
  const fn = url.split("/").pop();
  // Skip hero, navigation, collection-level images
  if (fn.match(/hero|navigation|nav-|logo|banner/i)) return false;
  return true;
});

console.log(
  `Assigned: ${assignedUrls.size}, Unassigned product-relevant: ${unassigned.length}\n`,
);

// ─── Output: Write enriched data ──────────────────────────────────────────────
console.log("📊 Final image counts per product:\n");

const enrichedProducts = seedData.products.map((p) => {
  const images = productImages.has(p.handle)
    ? [...productImages.get(p.handle)]
    : [p.thumbnail];
  // Ensure thumbnail is first
  const thumbIdx = images.indexOf(p.thumbnail);
  if (thumbIdx > 0) {
    images.splice(thumbIdx, 1);
    images.unshift(p.thumbnail);
  } else if (thumbIdx === -1 && p.thumbnail) {
    images.unshift(p.thumbnail);
  }

  return { ...p, images };
});

// Stats
const imageCounts = {};
enrichedProducts.forEach((p) => {
  const n = p.images.length;
  imageCounts[n] = (imageCounts[n] || 0) + 1;
});

console.log("Image count distribution:");
Object.entries(imageCounts)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .forEach(([count, products]) => {
    console.log(`  ${count} images: ${products} products`);
  });

console.log("\nProducts with 2+ images:");
enrichedProducts
  .filter((p) => p.images.length >= 2)
  .forEach((p) => {
    console.log(`  ${p.handle}: ${p.images.length} images`);
    p.images.forEach((u) =>
      console.log(`    ${typeof u === "string" ? u.split("/").pop() : u}`),
    );
  });

// Also dump ALL unassigned URLs for manual review
const outputPath = path.resolve(__dirname, "all-ecommerce-images.json");
const report = {
  summary: {
    totalUniqueImages: allImageUrls.size,
    assignedToProducts: assignedUrls.size,
    unassigned: unassigned.length,
  },
  allImages: [...allImageUrls].sort(),
  unassignedImages: unassigned.sort(),
  productImageMap: Object.fromEntries(
    [...productImages.entries()].map(([h, urls]) => [h, [...urls]]),
  ),
  availableByType: Object.fromEntries(
    Object.entries(availableByType).map(([k, v]) => [k, v.sort()]),
  ),
};

fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`\n✅ Full image report saved to: ${outputPath}`);

// Save enriched seed data
const enrichedPath = path.resolve(
  __dirname,
  "tailwindui-products-enriched.json",
);
const enrichedData = { ...seedData, products: enrichedProducts };
fs.writeFileSync(enrichedPath, JSON.stringify(enrichedData, null, 2));
console.log(`✅ Enriched seed data saved to: ${enrichedPath}`);
