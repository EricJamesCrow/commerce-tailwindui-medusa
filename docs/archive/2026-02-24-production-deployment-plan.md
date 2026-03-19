# Production Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the commerce-tailwindui-medusa template to production — Medusa backend on Railway, Next.js storefront on Vercel — with TailwindUI seed data and proper secrets.

**Architecture:** Storefront at `medusa.crowcommerce.org` (Vercel) calls backend at `api.medusa.crowcommerce.org` (Railway). Railway manages PostgreSQL and Redis. Stripe stays in test mode.

**Tech Stack:** Medusa v2.13, Next.js 16, Railway, Vercel, PostgreSQL, Redis, Stripe (test)

---

### Task 1: Install Redis caching dependency

The caching-redis provider is not bundled with `@medusajs/medusa` and must be installed explicitly. The event-bus-redis, workflow-engine-redis, and locking-redis modules are resolved from `@medusajs/medusa/...` paths (already bundled).

**Files:**
- Modify: `backend/package.json`

**Step 1: Install the dependency**

Run from repo root:
```bash
cd backend && bun add @medusajs/caching-redis
```

Expected: `@medusajs/caching-redis` added to `dependencies` in `backend/package.json`.

**Step 2: Verify installation**

Run:
```bash
cd backend && bun pm ls | grep caching-redis
```

Expected: Shows `@medusajs/caching-redis` in the dependency tree.

**Step 3: Commit**

```bash
git add backend/package.json backend/bun.lock
git commit -m "chore: add @medusajs/caching-redis for production deployment

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Update medusa-config.ts for production

Add Redis modules (caching, event bus, workflow engine, locking), session storage, admin backend URL, and worker mode support. All Redis modules share a single `REDIS_URL` env var (Railway provides this automatically).

**Files:**
- Modify: `backend/medusa-config.ts`

**Step 1: Update medusa-config.ts**

Replace the entire file with:

```typescript
import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

if (!process.env.STRIPE_API_KEY) {
  console.warn("[medusa-config] STRIPE_API_KEY is not set — Stripe payments will not work")
}

if (process.env.STRIPE_API_KEY && !process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error(
    "[medusa-config] STRIPE_WEBHOOK_SECRET is required when STRIPE_API_KEY is set. " +
    "Without it, the webhook endpoint accepts unverified requests."
  )
}

const redisUrl = process.env.REDIS_URL

module.exports = defineConfig({
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL,
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    {
      resolve: "./src/modules/product-review",
    },
    {
      resolve: "./src/modules/wishlist",
    },
    // Stripe payment provider (conditional)
    ...(process.env.STRIPE_API_KEY
      ? [
          {
            resolve: "@medusajs/medusa/payment",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/payment-stripe",
                  id: "stripe",
                  options: {
                    apiKey: process.env.STRIPE_API_KEY,
                    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
                    capture: false,
                    automatic_payment_methods: true,
                  },
                },
              ],
            },
          },
        ]
      : []),
    // Production Redis modules (conditional on REDIS_URL)
    ...(redisUrl
      ? [
          {
            resolve: "@medusajs/medusa/caching",
            options: {
              providers: [
                {
                  resolve: "@medusajs/caching-redis",
                  id: "caching-redis",
                  is_default: true,
                  options: {
                    redisUrl,
                  },
                },
              ],
            },
          },
          {
            resolve: "@medusajs/medusa/event-bus-redis",
            options: {
              redisUrl,
            },
          },
          {
            resolve: "@medusajs/medusa/workflow-engine-redis",
            options: {
              redis: {
                redisUrl,
              },
            },
          },
          {
            resolve: "@medusajs/medusa/locking",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/locking-redis",
                  id: "locking-redis",
                  is_default: true,
                  options: {
                    redisUrl,
                  },
                },
              ],
            },
          },
        ]
      : []),
  ],
})
```

Key changes from previous version:
- Added `admin.backendUrl` for admin dashboard in production
- Added `projectConfig.redisUrl` for session storage
- Redis modules (caching, event bus, workflow engine, locking) are conditional on `REDIS_URL` — they only activate in production, dev continues using in-memory defaults
- Extracted `redisUrl` variable to avoid repetition

**Step 2: Verify dev server still starts**

Run:
```bash
cd backend && bun run dev
```

Expected: Server starts on port 9000 with no Redis errors (Redis modules are skipped when `REDIS_URL` is unset). Ctrl+C to stop.

**Step 3: Commit**

```bash
git add backend/medusa-config.ts
git commit -m "feat: add Redis production modules and admin backend URL to medusa-config

Conditionally enables caching-redis, event-bus-redis, workflow-engine-redis,
and locking-redis when REDIS_URL is set. Dev continues using in-memory defaults.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Create cleaned seed data JSON

Save the TailwindUI seed data with "Women" and "Men" products removed (they were navigation labels, not real products). This gives us 65 products across 6 collections.

**Files:**
- Create: `backend/src/scripts/seed-data/tailwindui-products.json`

**Step 1: Create the directory**

```bash
mkdir -p backend/src/scripts/seed-data
```

**Step 2: Write the cleaned seed JSON**

Create `backend/src/scripts/seed-data/tailwindui-products.json` with:
- The full seed JSON provided by the user
- Remove the two products with handles `women` and `men` from the `products` array
- Remove `women` and `men` from the Accessories collection's `products` array
- Update `_meta.totalUniqueProducts` to 65

**Step 3: Verify the JSON**

Run:
```bash
cd backend && node -e "
  const data = require('./src/scripts/seed-data/tailwindui-products.json');
  console.log('Products:', data.products.length);
  console.log('Collections:', data.collections.length);
  const handles = data.products.map(p => p.handle);
  console.log('Has women:', handles.includes('women'));
  console.log('Has men:', handles.includes('men'));
"
```

Expected:
```
Products: 65
Collections: 6
Has women: false
Has men: false
```

**Step 4: Commit**

```bash
git add backend/src/scripts/seed-data/tailwindui-products.json
git commit -m "chore: add TailwindUI seed data (65 products, 6 collections)

Extracted from TailwindUI Plus Components v3.0.0. Removed 'Women' and 'Men'
entries that were navigation labels, not products.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Rewrite seed script with TailwindUI data

Replace the hardcoded 4-product seed script with a data-driven version that reads from the JSON and creates 65 products across 6 collections. Changes the default region from Europe/EUR to US/USD.

**Files:**
- Modify: `backend/src/scripts/seed.ts`

**Step 1: Rewrite the seed script**

The new seed script should:

1. **Store setup** — USD as default currency, EUR as secondary (flipped from current)
2. **Sales channel** — Same "Default Sales Channel" logic
3. **Region** — Create "United States" region with `us` country code, USD currency, and Stripe payment provider (if configured)
4. **Tax regions** — US only
5. **Stock location** — "US Warehouse" in New York
6. **Fulfillment** — Same shipping profile + options, but for US geo zone
7. **Publishable API key** — Same logic
8. **Collections** — Read `collections` from JSON, create via `createCollectionsWorkflow`, build `title → id` map
9. **Products** — Read `products` from JSON, for each product:
   - Map `category` field to `collection_id` via the title→id map
   - Convert `variant.prices[].amount` from cents to major units (divide by 100)
   - Pass `options`, `variants`, `images`, `thumbnail`, `shipping_profile_id`, `sales_channels`
   - Create in batches of 10 via `createProductsWorkflow`
10. **Inventory** — Same logic (1,000,000 stocked per item)

Key imports to add:
```typescript
import { createCollectionsWorkflow } from "@medusajs/medusa/core-flows"
import seedData from "./seed-data/tailwindui-products.json"
```

Key type for the JSON import — add to the top of the file or use type assertion:
```typescript
interface SeedProduct {
  title: string
  handle: string
  description: string
  status: string
  category: string
  thumbnail: string
  images: { url: string }[]
  options: { title: string; values: string[] }[]
  variants: {
    title: string
    sku: string
    prices: { currency_code: string; amount: number }[]
    options: Record<string, string>
    manage_inventory: boolean
  }[]
}

interface SeedCollection {
  title: string
  handle: string
  products: string[]
}

interface SeedData {
  collections: SeedCollection[]
  products: SeedProduct[]
}
```

Product creation batch loop:
```typescript
const BATCH_SIZE = 10
for (let i = 0; i < seedData.products.length; i += BATCH_SIZE) {
  const batch = seedData.products.slice(i, i + BATCH_SIZE)
  logger.info(`Seeding products ${i + 1}–${Math.min(i + BATCH_SIZE, seedData.products.length)} of ${seedData.products.length}...`)

  await createProductsWorkflow(container).run({
    input: {
      products: batch.map((product) => ({
        title: product.title,
        handle: product.handle,
        description: product.description,
        status: ProductStatus.PUBLISHED,
        thumbnail: product.thumbnail,
        shipping_profile_id: shippingProfile.id,
        collection_id: collectionMap.get(product.category),
        images: product.images,
        options: product.options.length > 0 ? product.options : undefined,
        variants: product.variants.map((variant) => ({
          title: variant.title,
          sku: variant.sku,
          options: Object.keys(variant.options).length > 0 ? variant.options : undefined,
          prices: variant.prices.map((price) => ({
            currency_code: price.currency_code,
            amount: price.amount / 100, // cents → major units
          })),
          manage_inventory: variant.manage_inventory,
        })),
        sales_channels: [{ id: defaultSalesChannel[0].id }],
      })),
    },
  })
}
```

**Step 2: Add JSON import support to tsconfig**

Check if `backend/tsconfig.json` has `resolveJsonModule: true`. If not, add it.

**Step 3: Test seed locally**

This requires a clean local database. Only run if you want to verify:
```bash
cd backend && bun run seed
```

Expected: Logs show 65 products created across 6 collections, inventory levels set. Products visible in admin at `localhost:9000/app`.

**Step 4: Commit**

```bash
git add backend/src/scripts/seed.ts
git commit -m "feat: rewrite seed script with TailwindUI product data

Replaces 4 hardcoded Medusa products with 65 TailwindUI products across
6 collections (Tops, Bags, Drinkware, Accessories, Stationery, Home & Office).
Changes default region from Europe/EUR to US/USD.
Prices converted from cents to major currency units.
Products created in batches of 10.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Create environment variable templates

Document all required production env vars for both workspaces. No actual secrets — just placeholder descriptions.

**Files:**
- Create: `backend/.env.production.template`
- Create: `storefront/.env.production.template`

**Step 1: Create backend template**

```bash
# backend/.env.production.template
```

```env
# === Railway auto-provisioned ===
DATABASE_URL=              # Railway PostgreSQL plugin provides this
REDIS_URL=                 # Railway Redis plugin provides this

# === Security secrets (generate with: openssl rand -hex 32) ===
JWT_SECRET=                # 64-char hex string
COOKIE_SECRET=             # 64-char hex string

# === CORS (set to your production domains) ===
STORE_CORS=https://medusa.crowcommerce.org
ADMIN_CORS=https://api.medusa.crowcommerce.org
AUTH_CORS=https://api.medusa.crowcommerce.org

# === Stripe (test mode) ===
STRIPE_API_KEY=            # sk_test_... from Stripe dashboard
STRIPE_WEBHOOK_SECRET=     # whsec_... from Stripe webhook for this endpoint

# === Admin ===
MEDUSA_BACKEND_URL=https://api.medusa.crowcommerce.org
```

**Step 2: Create storefront template**

```env
# === Backend connection ===
MEDUSA_BACKEND_URL=https://api.medusa.crowcommerce.org

# === Medusa publishable key (retrieve from production DB after seeding) ===
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=   # pk_... from admin or psql query

# === Stripe (test mode) ===
NEXT_PUBLIC_STRIPE_KEY=               # pk_test_... from Stripe dashboard

# === Site metadata ===
SITE_NAME=CrowCommerce Medusa Demo
COMPANY_NAME=CrowCommerce

# === Cache invalidation (generate with: openssl rand -hex 32) ===
REVALIDATE_SECRET=                    # 64-char hex string
```

**Step 3: Add templates to .gitignore exclusion**

Verify that `.env.production.template` files are NOT gitignored (they should be committed). Check `.gitignore` — typically `*.env*` patterns exclude `.env` but not `.env.*.template`. If they are excluded, add explicit `!.env.production.template` lines.

**Step 4: Commit**

```bash
git add backend/.env.production.template storefront/.env.production.template
git commit -m "docs: add production environment variable templates

Documents all required env vars for Railway (backend) and Vercel (storefront)
deployment. No actual secrets — just descriptions and placeholders.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Deploy to Railway (manual steps)

These are manual steps performed in the Railway dashboard and CLI. Document them here for reference.

**Prerequisites:**
- Railway account with CrowCommerce team
- Railway CLI installed (`brew install railway` or `npm i -g @railway/cli`)
- GitHub repo pushed to remote

**Step 1: Create Railway project**

1. Go to Railway dashboard → New Project
2. Name: "CrowCommerce Medusa"
3. Team: CrowCommerce

**Step 2: Add PostgreSQL**

1. In the project, click "New" → "Database" → "PostgreSQL"
2. Railway auto-provisions and sets `DATABASE_URL`

**Step 3: Add Redis**

1. Click "New" → "Database" → "Redis"
2. Railway auto-provisions and sets `REDIS_URL`

**Step 4: Add backend service**

1. Click "New" → "GitHub Repo" → select the commerce-tailwindui-medusa repo
2. In service settings:
   - Root Directory: `backend`
   - Build Command: `bun install && bun run build`
   - Start Command: `cd .medusa/server && bun install && bun run predeploy && bun run start`
3. Set environment variables (copy from `backend/.env.production.template`, fill in real values):
   - `DATABASE_URL` → reference Railway Postgres variable
   - `REDIS_URL` → reference Railway Redis variable
   - `JWT_SECRET` → run `openssl rand -hex 32` locally, paste result
   - `COOKIE_SECRET` → run `openssl rand -hex 32` locally, paste result
   - `STORE_CORS` → `https://medusa.crowcommerce.org`
   - `ADMIN_CORS` → `https://api.medusa.crowcommerce.org`
   - `AUTH_CORS` → `https://api.medusa.crowcommerce.org`
   - `STRIPE_API_KEY` → existing `sk_test_...` key
   - `STRIPE_WEBHOOK_SECRET` → leave empty for now (set after Step 8)
   - `MEDUSA_BACKEND_URL` → `https://api.medusa.crowcommerce.org`

**Step 5: Deploy and verify**

1. Trigger deploy
2. Wait for build to complete
3. Visit `<railway-url>/app` to verify admin dashboard loads

**Step 6: Add custom domain**

1. In Railway service settings → Networking → Custom Domain
2. Add `api.medusa.crowcommerce.org`
3. Railway shows the CNAME target
4. In DNS provider (Vercel or Spaceship), add CNAME record:
   - Name: `api.medusa`
   - Target: Railway-provided value
5. Wait for DNS propagation and SSL provisioning

**Step 7: Create admin user and run seed**

Using Railway CLI:
```bash
railway login
railway link  # link to the CrowCommerce Medusa project
railway run bunx medusa user -e admin@crowcommerce.org -p <secure-password>
railway run bun run seed
```

Or via Railway's console/shell in the dashboard.

After seeding, retrieve the publishable API key:
```bash
railway run bunx medusa exec -c "
  const query = container.resolve('query');
  const { data } = await query.graph({ entity: 'api_key', fields: ['token'], filters: { type: 'publishable' } });
  console.log('Publishable key:', data[0]?.token);
"
```

Or via the admin dashboard: Settings → API Key Management.

**Step 8: Configure Stripe webhook**

1. Go to Stripe Dashboard → Developers → Webhooks (test mode)
2. Add endpoint: `https://api.medusa.crowcommerce.org/hooks/payment/stripe_stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
4. Copy the signing secret (`whsec_...`)
5. In Railway, update `STRIPE_WEBHOOK_SECRET` env var with the new signing secret
6. Redeploy

---

### Task 7: Deploy to Vercel (manual steps)

**Prerequisites:**
- Vercel account with CrowCommerce team
- Publishable API key from Task 6, Step 7

**Step 1: Create Vercel project**

1. Go to Vercel dashboard → Add New → Project
2. Import the commerce-tailwindui-medusa GitHub repo
3. Team: CrowCommerce
4. Framework Preset: Next.js
5. Root Directory: `storefront`

**Step 2: Set environment variables**

- `MEDUSA_BACKEND_URL` → `https://api.medusa.crowcommerce.org`
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` → the key from Task 6 Step 7
- `NEXT_PUBLIC_STRIPE_KEY` → `pk_test_51T49x7ASfNGrOEyC8mh0fTLJNjUfR7tqQeAR5NtfDPVI0cOYCpdmzYcvmdDJifznPiuRaUhmyMWJR4hZ67KbkkIx00EBNI0Y8V`
- `SITE_NAME` → `CrowCommerce Medusa Demo`
- `COMPANY_NAME` → `CrowCommerce`
- `REVALIDATE_SECRET` → run `openssl rand -hex 32` locally, paste result

**Step 3: Deploy**

1. Click Deploy
2. Wait for build to complete
3. Visit the Vercel preview URL to verify the storefront loads with products

**Step 4: Add custom domain**

1. In Vercel project settings → Domains
2. Add `medusa.crowcommerce.org`
3. If DNS is on Vercel: automatic CNAME configuration
4. If DNS is on Spaceship: add CNAME record manually
   - Name: `medusa`
   - Target: `cname.vercel-dns.com`
5. Wait for DNS propagation and SSL provisioning

**Step 5: Verify full flow**

1. Browse products at `https://medusa.crowcommerce.org`
2. Click a product, add to cart
3. Proceed to checkout
4. Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC
5. Complete order
6. Verify order appears in admin at `https://api.medusa.crowcommerce.org/app`

---

### Task 8: Post-deployment verification checklist

After both services are deployed, verify:

- [ ] Products load on storefront (65 products visible)
- [ ] Collections show in navigation
- [ ] Product detail pages render with images, options, variants
- [ ] Add to cart works
- [ ] Cart drawer shows correct prices (not cents)
- [ ] Checkout flow completes with Stripe test card
- [ ] Admin dashboard accessible at `api.medusa.crowcommerce.org/app`
- [ ] Admin can view orders, products, collections
- [ ] Wishlist functionality works
- [ ] Customer signup/login works
- [ ] Product reviews can be submitted

Note any issues in TODO.md for follow-up.
