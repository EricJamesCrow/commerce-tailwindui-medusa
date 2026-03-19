# Production Deployment Design

Deploy the commerce-tailwindui-medusa template to production for troubleshooting and validation.

## Architecture

- **Storefront:** Next.js 16 on Vercel (CrowCommerce team) at `medusa.crowcommerce.org`
- **Backend:** Medusa v2 on Railway at `api.medusa.crowcommerce.org`
- **Database:** PostgreSQL managed by Railway (same private network as backend)
- **Cache:** Redis managed by Railway (same private network as backend)
- **Payments:** Stripe test mode (existing `sk_test_` / `pk_test_` keys)
- **DNS:** `crowcommerce.org` (Vercel or Spaceship.com)

## Environment Variables

### Backend (Railway)

| Variable | Value | Source |
|---|---|---|
| `DATABASE_URL` | Auto-provisioned | Railway Postgres plugin |
| `REDIS_URL` | Auto-provisioned | Railway Redis plugin |
| `JWT_SECRET` | 64-char random | `openssl rand -hex 32` |
| `COOKIE_SECRET` | 64-char random | `openssl rand -hex 32` |
| `STORE_CORS` | `https://medusa.crowcommerce.org` | Fixed |
| `ADMIN_CORS` | `https://api.medusa.crowcommerce.org` | Fixed |
| `AUTH_CORS` | `https://api.medusa.crowcommerce.org` | Fixed |
| `STRIPE_API_KEY` | `sk_test_...` (existing) | Existing test key |
| `STRIPE_WEBHOOK_SECRET` | New `whsec_...` | New Stripe webhook pointed at Railway URL |

### Storefront (Vercel)

| Variable | Value | Source |
|---|---|---|
| `MEDUSA_BACKEND_URL` | `https://api.medusa.crowcommerce.org` | Fixed |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Fetched from prod DB after seeding | Query or admin dashboard |
| `NEXT_PUBLIC_STRIPE_KEY` | `pk_test_...` (existing) | Existing test key |
| `SITE_NAME` | `CrowCommerce Medusa Demo` | Fixed |
| `COMPANY_NAME` | `CrowCommerce` | Fixed |
| `REVALIDATE_SECRET` | 64-char random | `openssl rand -hex 32` |

## Secrets Management

Three secrets need real values (currently `supersecret`):

- `JWT_SECRET` — generated via `openssl rand -hex 32`
- `COOKIE_SECRET` — generated via `openssl rand -hex 32`
- `REVALIDATE_SECRET` — generated via `openssl rand -hex 32`

Stripe credentials stay as test keys. A new webhook secret is created in the Stripe dashboard pointed at the Railway backend URL.

## DNS Configuration

Two CNAME records on `crowcommerce.org`:

| Record | Type | Name | Value |
|---|---|---|---|
| Storefront | CNAME | `medusa` | `cname.vercel-dns.com` |
| Backend | CNAME | `api.medusa` | Railway-provided domain |

SSL is automatic on both platforms.

## Seed Script

Replace the existing `backend/src/scripts/seed.ts` (which has 4 hardcoded Medusa products) with a data-driven version that reads from `backend/src/scripts/seed-data/tailwindui-products.json`.

### What stays the same

- Store setup (USD default, EUR secondary)
- Sales channel, publishable API key
- Stock location, fulfillment, shipping profiles/options
- Inventory levels (high stock)
- Idempotency checks

### What changes

- **Region:** US/USD default instead of Europe/EUR
- **Products:** 65 products from TailwindUI seed data (67 minus "Women" and "Men" which were navigation labels, not products)
- **Collections:** 6 collections (Tops, Bags, Drinkware, Accessories, Stationery, Home & Office) created first, then `collection_id` passed directly in `createProductsWorkflow` input
- **Price conversion:** Seed JSON uses cents (3200 = $32.00); Medusa v2 uses major units (32 = $32.00) — divide by 100
- **Batching:** Products created in batches of ~10 to avoid overloading the database

### Seed JSON location

`backend/src/scripts/seed-data/tailwindui-products.json` — the TailwindUI seed data with "Women" and "Men" entries removed.

## Code Changes Required

### 1. `backend/medusa-config.ts`

Add Redis configuration for event bus and caching modules. Railway provides `REDIS_URL` automatically.

### 2. `backend/src/scripts/seed.ts`

Replace with TailwindUI data-driven version (see Seed Script section above).

### 3. `backend/src/scripts/seed-data/tailwindui-products.json`

New file — the TailwindUI seed data (65 products, 6 collections, ~82 variants).

### 4. `backend/.env.production.template`

New file documenting all required production env vars (no actual secrets).

### 5. `storefront/.env.production.template`

New file documenting all required production env vars (no actual secrets).

## Deployment Workflow

### Phase 1: Railway backend setup

1. Create Railway project ("CrowCommerce Medusa") on CrowCommerce team
2. Add PostgreSQL plugin (auto-provisions `DATABASE_URL`)
3. Add Redis plugin (auto-provisions `REDIS_URL`)
4. Add backend service (connect GitHub repo, root directory: `backend/`)
5. Build command: `bun install && bun run build`
6. Start command: `bun run start`
7. Generate secrets locally, set all env vars
8. Deploy, verify admin dashboard loads at `*.up.railway.app/app`
9. Add custom domain `api.medusa.crowcommerce.org`, configure DNS CNAME

### Phase 2: Seed production data

10. Create admin user via Railway CLI/console
11. Run seed script via Railway CLI
12. Verify products in admin dashboard
13. Retrieve publishable API key

### Phase 3: Stripe webhook

14. Create new webhook in Stripe test dashboard: `https://api.medusa.crowcommerce.org/hooks/payment/stripe_stripe`
15. Subscribe to payment events
16. Copy `whsec_...` to Railway env var

### Phase 4: Vercel storefront setup

17. Create Vercel project on CrowCommerce team
18. Root directory: `storefront/`, framework: Next.js
19. Set env vars
20. Deploy, verify at preview URL
21. Add custom domain `medusa.crowcommerce.org`, configure DNS CNAME
22. Verify full flow: browse → add to cart → checkout with test card
