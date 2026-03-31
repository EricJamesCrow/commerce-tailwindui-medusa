# Setup Guide

Local development through production deployment for the Commerce TailwindUI + Medusa monorepo.

## Prerequisites

### Required

| Tool           | Version  | Install                                                           |
| -------------- | -------- | ----------------------------------------------------------------- |
| **Bun**        | `1.1.18` | `curl -fsSL https://bun.sh/install \| bash`                       |
| **Node.js**    | `>=20`   | Required by Medusa runtime                                        |
| **PostgreSQL** | `17`     | `brew install postgresql@17 && brew services start postgresql@17` |

### Optional Services

These are all optional for local development. The app runs without them — each feature gracefully disables when its env vars are not set.

| Service             | Install / Setup                                                                            | What it enables                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **Redis**           | `brew install redis && brew services start redis`                                          | Caching, event bus, workflow engine, locking. Optional locally (in-memory fallback), required in production                      |
| **Meilisearch**     | `brew install meilisearch` — see [Local Meilisearch Setup](#7-meilisearch-optional) below  | Full-text search with faceted filtering. Falls back to Medusa REST search without it                                             |
| **Stripe CLI**      | `brew install stripe/stripe-cli/stripe`                                                    | Local webhook testing for payment flows                                                                                          |
| **Stripe Account**  | [dashboard.stripe.com](https://dashboard.stripe.com) — copy `sk_test_` and `pk_test_` keys | Payment processing (checkout, refunds)                                                                                           |
| **Resend Account**  | [resend.com](https://resend.com) — copy API key                                            | Transactional emails (order confirmations, password resets, admin alerts). Test locally with email preview: `bun run dev:emails` |
| **Cloudflare R2**   | [dash.cloudflare.com](https://dash.cloudflare.com) — create R2 bucket + API token          | Persistent file/image storage. Without it, files stored in-memory and lost on restart                                            |
| **Sentry Account**  | [sentry.io](https://sentry.io) — create Node.js + Next.js projects, copy DSN               | Error monitoring and performance tracing                                                                                         |
| **PostHog Account** | [posthog.com](https://posthog.com) — create project, copy Project API Key                  | Product analytics, feature flags, session replay                                                                                 |

## Clone & Install

```bash
git clone <repo-url> && cd commerce-tailwindui-medusa
bun install          # installs all workspaces from root
```

## Environment Variables

### Backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` — at minimum, set `DATABASE_URL`:

```
DATABASE_URL=postgres://localhost/medusa_db
```

All other variables have working defaults for local development. See `backend/.env.example` for the full list with documentation.

| Variable                         | Required         | Default (dev)                                 | Purpose                                               |
| -------------------------------- | ---------------- | --------------------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`                   | Yes              | —                                             | PostgreSQL connection string                          |
| `REDIS_URL`                      | Prod only        | —                                             | Redis for caching, events, workflows, locking         |
| `JWT_SECRET`                     | Yes              | `"supersecret"`                               | Auth token signing                                    |
| `COOKIE_SECRET`                  | Yes              | `"supersecret"`                               | Session cookie signing                                |
| `STORE_CORS`                     | Yes              | `http://localhost:3000`                       | Storefront origin                                     |
| `ADMIN_CORS`                     | Yes              | `http://localhost:5173,http://localhost:9000` | Admin UI origins                                      |
| `AUTH_CORS`                      | Yes              | `http://localhost:5173,http://localhost:9000` | Auth flow origins                                     |
| `STRIPE_API_KEY`                 | No               | —                                             | `sk_test_...` from Stripe dashboard                   |
| `STRIPE_WEBHOOK_SECRET`          | If Stripe        | —                                             | `whsec_...` from Stripe webhook endpoint              |
| `RESEND_API_KEY`                 | No               | —                                             | Enables email notifications                           |
| `RESEND_FROM_EMAIL`              | No               | `onboarding@resend.dev`                       | Sender address for emails                             |
| `STOREFRONT_URL`                 | No               | `http://localhost:3000`                       | Base URL for links in emails                          |
| `REVALIDATE_SECRET`              | No               | —                                             | Must match the storefront revalidation secret         |
| `MEDUSA_BACKEND_URL`             | Prod only        | —                                             | Public backend URL (admin UI build)                   |
| `ADMIN_ORDER_EMAILS`             | No               | —                                             | Comma-separated emails for order alerts               |
| `CART_RECOVERY_SECRET`           | If cart recovery | —                                             | HMAC secret for abandoned cart tokens                 |
| `S3_FILE_URL`                    | No               | —                                             | R2 public base URL (e.g. `https://pub-abc123.r2.dev`) |
| `S3_ACCESS_KEY_ID`               | No               | —                                             | Cloudflare R2 API token ID                            |
| `S3_SECRET_ACCESS_KEY`           | No               | —                                             | Cloudflare R2 API token secret                        |
| `S3_BUCKET`                      | No               | —                                             | R2 bucket name (e.g. `crowcommerce-assets`)           |
| `S3_REGION`                      | No               | `auto`                                        | Always `auto` for Cloudflare R2                       |
| `S3_ENDPOINT`                    | No               | —                                             | `https://<account-id>.r2.cloudflarestorage.com`       |
| `SENTRY_DSN`                     | No               | —                                             | Sentry project DSN for error monitoring               |
| `SENTRY_ENVIRONMENT`             | No               | `development`                                 | Backend Sentry environment tag                        |
| `SENTRY_TRACES_SAMPLE_RATE`      | No               | `0.2`                                         | Trace sample rate (0.0-1.0)                           |
| `MEILISEARCH_HOST`               | No               | —                                             | Meilisearch server URL (e.g. `http://127.0.0.1:7700`) |
| `MEILISEARCH_API_KEY`            | If Meilisearch   | —                                             | Meilisearch master key (admin access)                 |
| `MEILISEARCH_REGION_ID`          | If Meilisearch   | —                                             | Region ID used for calculated-price indexing          |
| `MEILISEARCH_PRODUCT_INDEX_NAME` | No               | `products`                                    | Meilisearch index name for products                   |

### Storefront

```bash
cp storefront/.env.example storefront/.env.local
```

Edit `storefront/.env.local` — at minimum, set `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` after seeding:

| Variable                                 | Required         | Default (dev)                                    | Purpose                                                                      |
| ---------------------------------------- | ---------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `MEDUSA_BACKEND_URL`                     | Yes              | `http://localhost:9000`                          | Medusa API endpoint                                                          |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`     | Yes              | —                                                | `pk_...` from seed output or admin                                           |
| `NEXT_PUBLIC_STRIPE_KEY`                 | No               | —                                                | `pk_test_...` from Stripe dashboard                                          |
| `NEXT_PUBLIC_DEFAULT_REGION_ID`          | No               | —                                                | Skip region detection (use specific region)                                  |
| `NEXT_PUBLIC_SITE_URL`                   | No               | Vercel production URL or `http://localhost:3000` | Preferred canonical/site URL for metadata, sitemap, robots, JSON-LD          |
| `NEXT_PUBLIC_SITE_LOGO_URL`              | No               | —                                                | Logo URL for homepage Organization JSON-LD                                   |
| `SITE_NAME`                              | No               | —                                                | Browser tab title, OG images                                                 |
| `COMPANY_NAME`                           | No               | —                                                | Footer copyright                                                             |
| `SITE_COMPANY_LEGAL_NAME`                | No               | —                                                | Legal entity name for Organization JSON-LD                                   |
| `SITE_COMPANY_PHONE`                     | No               | —                                                | Support phone number for Organization JSON-LD                                |
| `SITE_COMPANY_EMAIL`                     | No               | —                                                | Support email for Organization JSON-LD                                       |
| `SITE_COMPANY_SAME_AS`                   | No               | —                                                | Comma-separated social/profile URLs for Organization JSON-LD                 |
| `REVALIDATE_SECRET`                      | No               | —                                                | On-demand cache revalidation token                                           |
| `NEXT_PUBLIC_CONSENT_FOUNDATION_ENABLED` | No               | `true`                                           | Enable cookie consent UI and consent-gated PostHog; attribution persistence stays on either way |
| `S3_IMAGE_HOSTNAME`                      | No               | —                                                | R2 public hostname for `next/image` (e.g. `pub-abc123.r2.dev`)               |
| `CART_RECOVERY_SECRET`                   | If cart recovery | —                                                | Same secret as backend (HMAC verification)                                   |
| `NEXT_PUBLIC_SENTRY_DSN`                 | No               | —                                                | Sentry DSN (safe to expose client-side)                                      |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`  | No               | `0.2`                                            | Client-side trace sample rate                                                |
| `SENTRY_TRACES_SAMPLE_RATE`              | No               | `0.2`                                            | Server-side trace sample rate                                                |
| `NEXT_PUBLIC_MEILISEARCH_HOST`           | No               | —                                                | Meilisearch server URL (e.g. `http://127.0.0.1:7700`)                        |
| `NEXT_PUBLIC_MEILISEARCH_API_KEY`        | If Meilisearch   | —                                                | Meilisearch search-only API key                                              |
| `NEXT_PUBLIC_MEILISEARCH_INDEX_NAME`     | No               | `products`                                       | Meilisearch index name for products                                          |

## Local Development

### 1. Create the database

```bash
createdb medusa_db
```

### 2. Run migrations

```bash
cd backend && bunx medusa db:migrate
```

### 3. Seed the database

```bash
cd backend && bun run seed
```

The seed script creates: a store with USD currency, a US region, tax region, stock location, fulfillment set, 2 shipping options (Standard $5, Express $10), a publishable API key, 6 collections, and 65 products with variants, prices, images, and inventory levels.

**Copy the publishable API key** from the seed output and add it to `storefront/.env.local`:

```
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...
```

You can also retrieve it later from the Medusa Admin UI at `http://localhost:9000/app` → Settings → API Keys, or via SQL:

```bash
psql medusa_db -c "SELECT token FROM api_key WHERE type = 'publishable' LIMIT 1;"
```

### 4. Create an admin user

```bash
cd backend && bunx medusa user -e admin@example.com -p supersecret
```

### 5. Start development servers

```bash
bun run dev
```

This starts all services in parallel:

| Service       | URL                       | Port |
| ------------- | ------------------------- | ---- |
| Storefront    | http://localhost:3000     | 3000 |
| Backend API   | http://localhost:9000     | 9000 |
| Admin UI      | http://localhost:9000/app | 9000 |
| Email Preview | http://localhost:3003     | 3003 |

Or start individually:

```bash
bun run dev:storefront   # Storefront only
bun run dev:backend      # Backend only
bun run dev:emails       # Email preview only
```

### 6. Stripe webhooks (optional)

To test Stripe payment flows locally:

```bash
stripe listen --forward-to localhost:9000/hooks/payment/stripe_stripe
```

Copy the `whsec_...` signing secret from the CLI output into `backend/.env`:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 7. Meilisearch (optional)

For full-text search with faceted filtering. Without this, the storefront uses Medusa's built-in REST search.

```bash
# Install
brew install meilisearch

# Start with a master key (use any string — this is for local dev only)
meilisearch --master-key="test-master-key-123"
```

Meilisearch runs on `http://127.0.0.1:7700`. Add to your env files:

**`backend/.env`:**

```
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=test-master-key-123
```

**`storefront/.env.local`:**

```
NEXT_PUBLIC_MEILISEARCH_HOST=http://127.0.0.1:7700
NEXT_PUBLIC_MEILISEARCH_API_KEY=test-master-key-123
```

After starting the backend, trigger the initial product sync:

```bash
# Get an admin auth token first
curl -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"<admin-email>","password":"<admin-password>"}'

# Trigger sync (use the token from above)
curl -X POST http://localhost:9000/admin/meilisearch/sync \
  -H "Authorization: Bearer <token>"
```

See `docs/features/search.md` for full customization and troubleshooting guide.

### 8. Legal Pages

The storefront ships with five placeholder legal pages:

- `/privacy-policy`
- `/terms-of-service`
- `/return-policy`
- `/shipping-policy`
- `/cookie-policy`

**To replace with your actual legal content:**

1. Use [Termly](https://termly.io) (or a similar service) to generate policies specific to your store
2. Replace the placeholder text in `storefront/lib/constants/legal-content.ts`
3. Update the effective dates

When migrating to a CMS (e.g., Payload), swap the import source in each route file — the `PolicyPage` component and routes stay the same.

## Production Deployment

### Backend → Railway

1. **Create a Railway project** at [railway.app](https://railway.app) and add PostgreSQL + Redis plugins.

2. **Connect your repo** — point Railway to the `backend/` directory, or configure the root directory in service settings.

3. **Set environment variables** in the Railway service dashboard. See `backend/.env.example` for all variables with production notes. Required for production:

   ```
   DATABASE_URL=          # Auto-provisioned by Railway PostgreSQL plugin
   REDIS_URL=             # Auto-provisioned by Railway Redis plugin
   JWT_SECRET=            # Generate: openssl rand -hex 32
   COOKIE_SECRET=         # Generate: openssl rand -hex 32
   STORE_CORS=            # Your storefront domain, e.g. https://store.example.com
   ADMIN_CORS=            # Your backend domain, e.g. https://api.example.com
   AUTH_CORS=              # Same as ADMIN_CORS
   MEDUSA_BACKEND_URL=    # Your backend domain, e.g. https://api.example.com
   REVALIDATE_SECRET=     # Must exactly match the storefront REVALIDATE_SECRET
   S3_FILE_URL=            # R2 public URL (e.g. https://pub-abc123.r2.dev)
   S3_ACCESS_KEY_ID=       # R2 API token ID
   S3_SECRET_ACCESS_KEY=   # R2 API token secret
   S3_BUCKET=              # Bucket name (e.g. crowcommerce-assets)
   S3_REGION=auto          # Always "auto" for Cloudflare R2
   S3_ENDPOINT=            # https://<account-id>.r2.cloudflarestorage.com
   SENTRY_DSN=              # Sentry project DSN
   SENTRY_ENVIRONMENT=     # "production" in prod, "staging" in non-prod Railway envs
   MEILISEARCH_HOST=        # Meilisearch server URL (e.g. https://ms-xxx.meilisearch.io or self-hosted)
   MEILISEARCH_API_KEY=     # Meilisearch master key (admin access for indexing)
   MEILISEARCH_REGION_ID=   # Region ID used for accurate calculated-price indexing
   ```

4. **Deploy** — Railway detects the `Dockerfile` and `railway.toml` automatically. The container runs migrations on startup (`bunx medusa db:migrate && bun run start`).

5. **Seed production** — after the first deploy, run the seed script via Railway CLI or exec:

   ```bash
   railway run bun run seed
   ```

   Copy the publishable API key for the storefront deployment.

### Storefront → Vercel

1. **Import the repo** in the [Vercel dashboard](https://vercel.com/new) under the **CrowCommerce** team (slug: `crow-commerce`). Use the project `commerce-tailwindui-medusa` and set the root directory to `storefront/`.

2. **Set environment variables** in Vercel project settings:

   ```
   MEDUSA_BACKEND_URL=                      # Your Railway backend URL
   NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=      # pk_... from seed output
   NEXT_PUBLIC_STRIPE_KEY=                  # pk_test_... (if using Stripe)
   NEXT_PUBLIC_SITE_URL=                    # Preferred public storefront URL, e.g. https://store.example.com
   NEXT_PUBLIC_SITE_LOGO_URL=               # Public logo URL for Organization JSON-LD
   SITE_NAME=                               # Your store name
   COMPANY_NAME=                            # Footer copyright
   SITE_COMPANY_LEGAL_NAME=                 # Legal entity name for Organization JSON-LD
   SITE_COMPANY_PHONE=                      # Support phone number (optional)
   SITE_COMPANY_EMAIL=                      # Support email (optional)
   SITE_COMPANY_SAME_AS=                    # Comma-separated social/profile URLs (optional)
   REVALIDATE_SECRET=                       # Generate: openssl rand -hex 32
   NEXT_PUBLIC_CONSENT_FOUNDATION_ENABLED=  # true for consent UI + gated PostHog, false for legacy always-on analytics without the consent layer
   NEXT_PUBLIC_SENTRY_DSN=                  # Sentry project DSN
   SENTRY_AUTH_TOKEN=                       # Source map uploads (sentry.io/settings/auth-tokens/)
   SENTRY_ORG=                              # Sentry organization slug
   SENTRY_PROJECT=                          # Sentry project slug
   NEXT_PUBLIC_SENTRY_ENVIRONMENT=          # "production" for prod, "preview" for Vercel previews
   NEXT_PUBLIC_MEILISEARCH_HOST=            # Meilisearch server URL (same as backend)
   NEXT_PUBLIC_MEILISEARCH_API_KEY=         # Meilisearch search-only API key (NOT master key)
   ```

3. **Deploy** — Vercel detects `vercel.json` (`installCommand: "bun install"`, framework: `nextjs`) and builds automatically.

4. **Update backend CORS** — add your Vercel production domain to `STORE_CORS` in Railway.

5. **Sanity-check Vercel env formatting** — after setting or updating critical Vercel vars, run `vercel env pull --environment=production` and confirm URL/key values do not include trailing newlines. A pasted newline in `MEDUSA_BACKEND_URL` can break the storefront proxy's CSP header and produce production 500s.

6. **Verify Sentry build inputs** — confirm `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` all match the storefront Sentry project, and that `NEXT_PUBLIC_SENTRY_ENVIRONMENT` is set explicitly. Vercel previews should report as `preview`; production should report as `production`.

### Catalog Cache Revalidation

When both the backend and storefront have the same `REVALIDATE_SECRET` configured, Medusa subscribers automatically POST to `POST /api/revalidate` after product and product-collection create, update, and delete events.

To verify the production path end-to-end:

1. Update a product or collection in Medusa admin.
2. Confirm the backend logs a `[StorefrontRevalidate]` success entry.
3. Confirm the storefront receives the request and the updated catalog data appears without waiting for the catalog TTL to expire.
4. If it fails, verify `STOREFRONT_URL` and `REVALIDATE_SECRET` are set in Railway, and that `REVALIDATE_SECRET` matches the value in Vercel exactly.

## Structured Data Coverage

The storefront emits typed JSON-LD for:

- Homepage: `Organization`
- Product detail pages: `Product`, `BreadcrumbList`
- Product listing pages: `ItemList`
- Collection pages: `BreadcrumbList`, `ItemList`

Absolute URLs for metadata, sitemap, robots, and JSON-LD prefer `NEXT_PUBLIC_SITE_URL`. If it is unset, the storefront falls back to Vercel's production URL and finally `http://localhost:3000` for local development.

Homepage `Organization` schema is only as complete as the env vars provided. Missing optional values are omitted rather than guessed.

### Stripe Webhooks (Production)

1. In the [Stripe Dashboard](https://dashboard.stripe.com/webhooks), create a webhook endpoint:

   - **URL:** `https://api.example.com/hooks/payment/stripe_stripe`
   - **Events:** `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`

2. Copy the signing secret (`whsec_...`) and set `STRIPE_WEBHOOK_SECRET` in Railway.

## Post-Deploy Verification

- [ ] Backend health: `curl https://api.example.com/health` returns `200`
- [ ] Admin UI loads: `https://api.example.com/app`
- [ ] Storefront loads with products
- [ ] Add to cart → checkout flow works
- [ ] Stripe test payment succeeds (if configured)
- [ ] Order confirmation email sends (if Resend configured)
- [ ] Admin order alert email sends (if `ADMIN_ORDER_EMAILS` configured)
- [ ] Meilisearch search works: trigger sync (`POST /admin/meilisearch/sync`), verify faceted search on storefront (if Meilisearch configured)

## Common Issues

### `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` is empty

The storefront won't load products. Run the seed script and copy the key, or query it from the database.

### CORS errors in browser console

Backend CORS variables (`STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`) must include the exact origin making the request (protocol + domain + port, no trailing slash). Multiple origins are comma-separated.

### `JWT_SECRET must be set to a secure value in production`

`medusa-config.ts` enforces secure secrets in production. Generate with `openssl rand -hex 32`.

### Stripe payments not working

- `STRIPE_API_KEY` must be set in the backend for the Stripe payment module to load
- `STRIPE_WEBHOOK_SECRET` is required in production when Stripe is enabled
- `NEXT_PUBLIC_STRIPE_KEY` must be set in the storefront for the payment form to render
- Webhook URL must match exactly: `https://<backend>/hooks/payment/stripe_stripe`

### Emails not sending

The Resend notification module only loads when `RESEND_API_KEY` is set. Verify with the email preview server (`bun run dev:emails` on port 3003).

### Database connection refused

Ensure PostgreSQL is running: `brew services start postgresql@17`. Verify the `DATABASE_URL` connection string.

### Redis modules not loading

Redis-backed modules (caching, event bus, workflow engine, locking) only load when `REDIS_URL` is set. This is optional for local development but required for production.
