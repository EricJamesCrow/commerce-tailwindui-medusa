# AGENTS.md

Comprehensive technical reference for the commerce-tailwindui-medusa storefront. For agent behavior and workflow, see **[CLAUDE.md](./CLAUDE.md)**.

## Review guidelines

### P0 — Security
- All server actions must validate and sanitize input before processing
- Cookie operations must use the dedicated functions in `lib/medusa/cookies.ts` — never set cookies directly
- Cookies must use httpOnly, sameSite strict, and secure (in production) flags
- No sensitive data (cart IDs, customer info, payment sessions, JWT tokens) exposed in client components or client-side code
  - **Exception:** Stripe Payment Element requires `client_secret` on the client, and cart IDs in payment callback URLs are needed for redirect-based flows (3D Secure, PayPal). Server actions validate cart ownership via `assertSessionCart()`.
- No API keys, secrets, or tokens in client bundles — check for `NEXT_PUBLIC_` prefix misuse
- Server actions handling cart/checkout mutations must enforce authentication where required via `getAuthHeaders()`
- Payment flows must not be manipulable — no client-controlled pricing, no cart state injection, no replay vectors
- All customer-facing API routes must validate the requesting user owns the resource (prevent IDOR)
- Never trust Stripe `redirect_status` or client-side payment intent status — always validate server-side via `completeCart()`
- `STRIPE_WEBHOOK_SECRET` must be set whenever `STRIPE_API_KEY` is configured — flag if webhook verification is missing or bypassed
- Express checkout flows must validate email presence before proceeding to payment
- Non-terminal payment statuses (e.g., "processing", "requires_action") must surface user-facing errors — never silently no-op or swallow the status

### P0 — Correctness
- Cart mutations must call both `revalidateTag(TAGS.cart, "max")` AND `revalidatePath("/", "layout")` — missing either causes stale UI
- Cart revalidation must run in `finally` blocks so optimistic state re-syncs even on failure
- Medusa v2 prices are in major currency units (10 = $10.00) — never divide by 100
- Cart subtotal for display must use `item_subtotal` not `subtotal` (which includes shipping)
- API calls fetching product prices or variants must include `region_id` for calculated prices
- Error handling must use `medusaError()` from `lib/medusa/error.ts` — not raw try/catch with generic messages

### P1 — Architecture
- Client components must be limited to interactive needs (dialogs, optimistic updates, keyboard shortcuts) — default to RSC
- Server actions must follow the established pattern in `components/cart/actions.ts`
- No new `any` types in changed files — existing `any` usage in legacy files (order confirmation, checkout types) is tracked separately

### P1 — Maintainability
- Functions exceeding 80 lines should be flagged for review — procedural flows like checkout handlers may be acceptable if linear and well-commented
- Duplicated logic across server actions should use shared helpers
- Consistent error handling patterns across all server actions
- TypeScript strict mode compliance — no unchecked index access

## Project Overview

Next.js 16 ecommerce storefront built on Vercel's Commerce template, enhanced with premium Tailwind UI components. Integrates with a local Medusa.js v2 backend via the Store REST API. Designed for a polished, production-ready shopping experience with static generation, optimistic cart updates, and granular caching.

## Tech Stack

| Technology       | Version         | Purpose                                      |
| ---------------- | --------------- | -------------------------------------------- |
| Next.js          | 16.0.7 (canary) | App Router, RSC, Server Actions              |
| React            | 19.0.0          | Server Components, `useOptimistic`           |
| TypeScript       | 5.8.2           | Strict mode, `noUncheckedIndexedAccess`      |
| Tailwind CSS     | 4.x             | CSS-first config, `@theme` tokens            |
| Headless UI      | 2.2.x           | Accessible interactive components            |
| @medusajs/js-sdk | 2.13.x          | REST client for Medusa Store API             |
| @medusajs/types  | 2.13.x          | TypeScript types for Medusa responses        |
| clsx             | 2.1.x           | Conditional class composition                |
| ioredis          | 5.x             | Redis client (auth rate limiting)            |
| Geist            | 1.3.x           | Font family                                  |
| Vitest           | 4.x             | Unit testing (installed, not configured yet) |
| Playwright       | 1.56.x          | E2E testing (configured, 40 wishlist specs)  |

## Directory Structure

```
storefront/                        # Next.js 16 frontend
├── app/
│   ├── (auth)/                    # Route group — auth pages (no layout file)
│   │   └── account/
│   │       ├── login/             # Sign-in page
│   │       ├── register/          # Create account page
│   │       ├── forgot-password/   # Request password reset
│   │       └── reset-password/    # Set new password (from email link)
│   ├── (store)/                   # Route group — shares store layout
│   │   ├── layout.tsx             # Store-specific layout (nav + footer)
│   │   ├── products/
│   │   │   ├── page.tsx           # All products grid
│   │   │   └── [collection]/      # Collection-filtered products
│   │   └── search/
│   │       ├── page.tsx           # Search results
│   │       └── [collection]/      # Collection-specific search
│   ├── product/[handle]/          # Product detail pages (static generation)
│   ├── [page]/                    # Dynamic CMS pages (stub)
│   ├── api/revalidate/            # Webhook endpoint for cache invalidation
│   ├── page.tsx                   # Home page
│   ├── layout.tsx                 # Root layout
│   └── globals.css                # Tailwind v4 theme tokens
├── components/
│   ├── cart/                      # Cart drawer, actions (Server Actions), optimistic UI
│   ├── home/                      # Home page sections, Tailwind UI product/collection types
│   ├── layout/                    # Desktop/mobile navigation, footer
│   ├── price/                     # Context-specific price components (grid, detail, cart)
│   ├── product/                   # Product detail components
│   ├── reviews/                   # Product review form and display
│   ├── search-command/            # Command palette (Cmd+K) with debounced search
│   └── wishlist/                  # Heart button, wishlist page client, social proof count
├── lib/
│   ├── medusa/
│   │   ├── index.ts               # SDK client + all data-fetching functions
│   │   ├── cookies.ts             # Secure cookie management + auth headers
│   │   ├── customer.ts            # Customer auth: login, signup, signout, password reset, profile
│   │   ├── error.ts               # Centralized Medusa SDK error formatting
│   │   ├── transforms.ts          # Medusa → internal type transformations
│   │   └── wishlist.ts            # Wishlist server actions + data fetching
│   ├── constants.ts               # Cache tags, sort options, hidden product tag
│   ├── constants/navigation.ts    # DEFAULT_NAVIGATION fallback, UTILITY_NAV
│   ├── types.ts                   # Backend-agnostic internal types
│   ├── validation.ts              # Shared validation (password length)
│   └── utils.ts                   # URL helpers, env validation, Tailwind UI transforms
├── playwright.config.ts           # E2E test config (Chromium + Firefox)
├── tests/e2e/                     # E2E test suites
│   ├── fixtures/                  # API, auth, and wishlist test fixtures
│   ├── helpers/                   # Shared selectors
│   └── wishlist/                  # 10 wishlist spec files (40 tests)
├── package.json
└── next.config.ts

backend/                           # Medusa v2 backend
├── src/
│   ├── modules/                   # Custom modules (data models, services)
│   ├── api/                       # Custom REST API routes
│   │   ├── middlewares.ts         # Route middleware config (auth, validation, rate limiting)
│   │   └── middlewares/           # Custom middleware implementations
│   │       └── rate-limit.ts     # Redis-backed auth rate limiting
│   ├── workflows/                 # Custom workflows and steps
│   ├── links/                     # Module link definitions
│   ├── admin/                     # Admin UI extensions (React/Vite)
│   ├── subscribers/               # Event subscribers
│   └── scripts/                   # CLI scripts (seed, etc.)
├── medusa-config.ts
└── package.json
```

## Route Structure

| Route                      | Purpose                  | Notes                                |
| -------------------------- | ------------------------ | ------------------------------------ |
| `/`                        | Home page                | Static                               |
| `/products`                | All products grid        | Collection-filtered                  |
| `/products/[collection]`   | Products by collection   | Dynamic                              |
| `/product/[handle]`        | Product detail           | `generateStaticParams` at build time |
| `/search`                  | Search results           | Query-based                          |
| `/search/[collection]`     | Search within collection | Dynamic                              |
| `/collections/*`           | Rewrite                  | Rewrites to `/products/*`            |
| `/[page]`                  | CMS pages                | Stub — Medusa has no CMS             |
| `/account/login`           | Sign in                  | Redirects if logged in               |
| `/account/register`        | Create account            | Redirects if logged in               |
| `/account/forgot-password` | Request password reset   | Redirects if logged in               |
| `/account/reset-password`  | Set new password         | Accepts `token` + `email` params     |
| `/account/wishlist`        | Wishlist management      | Auth-protected, multi-list UI        |
| `/wishlist/shared/[token]` | Shared wishlist view     | Public read-only, import for authed  |
| `/api/revalidate`          | Webhook                  | Cache invalidation endpoint          |

## Data Layer Architecture

Three-layer type system with explicit transform boundaries:

### Layer 1: Medusa SDK Types

`HttpTypes.StoreProduct`, `HttpTypes.StoreCollection`, `HttpTypes.StoreCart` — raw REST responses from `@medusajs/types`.

### Layer 2: Internal Types (`lib/types.ts`)

Backend-agnostic types: `Product`, `Cart`, `Collection`, `Menu`, `Page`, `Navigation`. Used throughout the app. Could be backed by any commerce API.

### Layer 3: Tailwind UI Types (`components/home/types.ts`)

Component-specific types matching Tailwind UI component props: `Product` (grid format), `Collection` (card format).

Also in `lib/utils.ts`: `TailwindProductDetail`, `TailwindRelatedProduct`.

### Transform Chain

```
Medusa SDK → transforms.ts → Internal Types → utils.ts → Tailwind UI Types
  (Layer 1)                    (Layer 2)                   (Layer 3)
```

**`lib/medusa/transforms.ts`** (Layer 1 → Layer 2):

- `transformProduct()` — `HttpTypes.StoreProduct` → `Product`
- `transformCollection()` — `HttpTypes.StoreCollection` → `Collection`
- `transformCart()` — `HttpTypes.StoreCart` → `Cart`

**`lib/utils.ts`** (Layer 2 → Layer 3):

- `transformProductToTailwind()` — Grid/catalog format
- `transformProductToTailwindDetail()` — Product detail page
- `transformProductsToRelatedProducts()` — Related products section
- `transformCollectionToTailwind()` — Collection card format
- `getColorHex()` — Maps color names to hex codes for variant swatches

## Medusa SDK Client

Configured in `lib/medusa/index.ts`:

```typescript
const sdk = new Medusa({
  baseUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  debug: false,
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
});
```

**Single-region mode:** `getDefaultRegion()` fetches the first region and caches it in memory. All product queries include `region_id` to get `calculated_price`.

**Field expansion:** Products use `PRODUCT_FIELDS` to get calculated prices, inventory, and variant images. Carts use `CART_FIELDS` to get items with product/variant/thumbnail data, plus promotions and shipping methods.

**Cookie management (`lib/medusa/cookies.ts`):** All cookie access goes through dedicated functions (`getCartId`, `setCartId`, `removeCartId`, `getAuthToken`, `setAuthToken`, `removeAuthToken`). Cart cookie is `_medusa_cart_id` with `httpOnly`, `sameSite: strict`, `secure` (in prod), 30-day expiry. Auth token cookie is `_medusa_jwt` with same security flags, 7-day expiry.

**Auth headers:** `getAuthHeaders()` returns `{ authorization: "Bearer ..." }` when a JWT exists, or `{}` otherwise. All cart mutations and customer operations pass auth headers to the SDK.

**Auth actions (`lib/medusa/customer.ts`):** `login`, `signup`, `signout`, `requestPasswordReset`, `completePasswordReset`, `retrieveCustomer`, `updateCustomer`, address CRUD. All actions normalize emails to lowercase. Password reset actions use `sdk.auth.resetPassword()` and `sdk.auth.updateProvider()`. Rate-limited responses (429) are detected via `isRateLimited()` helper and surfaced as user-friendly messages.

**Password validation (`lib/validation.ts`):** `validatePassword()` enforces 8–128 character length. Used in `signup()` and `completePasswordReset()` server-side, and in register/reset forms client-side via exported `MIN_PASSWORD_LENGTH` constant.

**Error handling (`lib/medusa/error.ts`):** `medusaError()` formats `FetchError` from `@medusajs/js-sdk` (shape: `{ status, statusText, message }`) into user-readable `Error` objects with server-side logging.

## Exported Data Functions

| Function                                   | Cache         | Tags                    | Lifetime |
| ------------------------------------------ | ------------- | ----------------------- | -------- |
| `getProduct(handle)`                       | `"use cache"` | `products`              | `days`   |
| `getProducts({query, reverse, sortKey})`   | `"use cache"` | `products`              | `days`   |
| `getProductRecommendations(productId)`     | `"use cache"` | `products`              | `days`   |
| `getCollection(handle)`                    | `"use cache"` | `collections`           | `days`   |
| `getCollectionProducts({collection, ...})` | `"use cache"` | `collections, products` | `days`   |
| `getCollections()`                         | `"use cache"` | `collections`           | `days`   |
| `getNavigation()`                          | `"use cache"` | `collections`           | `days`   |
| `getMenu(handle)`                          | `"use cache"` | `collections`           | `days`   |
| `getCart()`                                | No cache      | —                       | —        |
| `getOrSetCart()`                           | No cache      | —                       | —        |
| `createCart()`                             | No cache      | —                       | —        |
| `addToCart(lines)`                         | No cache      | —                       | —        |
| `removeFromCart(lineIds)`                  | No cache      | —                       | —        |
| `updateCart(lines)`                        | No cache      | —                       | —        |
| `getPage(handle)`                          | No cache      | —                       | Stub     |
| `getPages()`                               | No cache      | —                       | Stub     |

## Caching Strategy

Uses Next.js 16 experimental caching with `"use cache"` directive:

```typescript
export async function getProduct(handle: string) {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");
  // ...
}
```

**next.config.ts:**

```typescript
{
  cacheComponents: true;
}
```

**Cache tags** (defined in `lib/constants.ts`): `collections`, `products`, `cart`, `customers`, `reviews`, `wishlists`.

**Invalidation:**

- Cart mutations: `revalidateTag(TAGS.cart, "max")` + `revalidatePath("/", "layout")`
- Webhook (`/api/revalidate`): Revalidates all three tags
- Manual: `rm -rf .next` and restart dev server

## Cart State Management

**Critical:** Cart updates require **both** tag revalidation **and** path revalidation for UI to update without hard refresh.

### Cart Pricing Fields

Medusa v2 cart total fields — use the right one for each context:

| Field | Meaning | Use for |
|-------|---------|---------|
| `item_subtotal` | Sum of line item subtotals (items only, excl. tax) | "Subtotal" label in cart/checkout |
| `subtotal` | `item_subtotal` + `shipping_subtotal` (excl. tax) | Rarely — includes shipping |
| `shipping_total` | Shipping after discounts, incl. tax | "Shipping" line item |
| `tax_total` | Total tax amount | "Tax" line item |
| `total` | Final total after discounts/credits, incl. tax | "Total" / "Order total" |

**Important:** `transformCart()` in `lib/medusa/transforms.ts` maps `cost.subtotalAmount` → `cart.item_subtotal` (not `cart.subtotal`) so that the internal `Cart` type's subtotal represents items only.

### Flow

1. **Storage:** Cart ID stored in `_medusa_cart_id` cookie (secure, httpOnly) via `lib/medusa/cookies.ts`
2. **Creation:** `createCartAndSetCookie()` → `createCart()` (sets cookie internally)
3. **Mutations:** Server Actions in `components/cart/actions.ts`:
   - `addItem(prevState, variantId)` — Add to cart
   - `removeItem(prevState, lineItemId)` — Remove from cart (uses line item ID directly)
   - `updateItemQuantity(prevState, {merchandiseId, quantity})` — Update quantity
   - `redirectToCheckout()` — Redirects to `/checkout`
4. **Optimistic UI:** Cart components use `useOptimistic` for instant feedback
5. **Revalidation pattern** (every mutation, in `finally` block):
   ```typescript
   revalidateTag(TAGS.cart, "max");
   revalidatePath("/", "layout"); // Essential for immediate UI updates
   ```
6. **Error recovery:** Revalidation runs in `finally` blocks — ensures optimistic state re-syncs even on failure

### Cart UI

- Sliding drawer using Headless UI `Dialog`
- Auto-opens when item is added
- Optimistic updates for instant feedback on add/remove/quantity changes

## Navigation System

`getNavigation()` builds nav from Medusa collections:

1. Fetches all collections via `getCollections()`
2. If collections exist (>1, since "All" is always added), maps them to nav links
3. Merges with `DEFAULT_NAVIGATION` categories structure
4. Falls back entirely to `DEFAULT_NAVIGATION` when no collections found

**Constants** (`lib/constants/navigation.ts`):

- `DEFAULT_NAVIGATION` — Full fallback with Women/Men categories, featured, brands
- `UTILITY_NAV` — Account, Support links

**Footer:** `getMenu("footer")` returns first 6 collections as footer links.

## Component Patterns

### RSC vs Client Split

Most components are Server Components. Client components are used only for:

- Cart drawer (Dialog interaction)
- Search command palette (keyboard shortcuts, input state)
- Add-to-cart button (optimistic updates via `useActionState`)
- Mobile menu (Dialog interaction)
- Wishlist button (heart toggle with server action)
- Wishlist page client (multi-tab, create/rename/delete dialogs, share)
- Review form (star rating, form submission)

### Price Components (`components/price/`)

Three context-specific components instead of one flexible component:

- `ProductGridPrice.tsx` — Grid/catalog views
- `ProductDetailPrice.tsx` — Product detail page
- `CartPrice.tsx` — Cart drawer

### Search Command Palette (`components/search-command/`)

- Opens with Cmd+K / Ctrl+K
- Real-time product search with debouncing
- Keyboard navigation support
- Uses `getProducts({ query })` for search

## Tailwind CSS v4

**CSS-first configuration** — no `tailwind.config.ts`. Everything in `app/globals.css`:

```css
@import "tailwindcss";
@plugin "@tailwindcss/container-queries";
@plugin "@tailwindcss/typography";

@theme {
  --color-primary-50: #eef2ff;
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;
  /* ... full primary + secondary scales */
}
```

**Theming:** Change `--color-primary-*` values in `@theme` to retheme the site. See [RETHEME.md](./RETHEME.md) for full guide.

## Environment Variables

| Variable                             | Required | Default                 | Purpose                               |
| ------------------------------------ | -------- | ----------------------- | ------------------------------------- |
| `MEDUSA_BACKEND_URL`                 | Yes      | `http://localhost:9000` | Medusa REST API URL                   |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Yes      | —                       | Medusa publishable API key            |
| `SITE_NAME`                          | No       | —                       | Store name in metadata                |
| `COMPANY_NAME`                       | No       | —                       | Company name in footer                |
| `REVALIDATE_SECRET`                  | No       | —                       | Webhook secret for cache invalidation |
| `VERCEL_PROJECT_PRODUCTION_URL`      | No       | —                       | Auto-set by Vercel for `baseUrl`      |

Validated on startup by `validateEnvironmentVariables()` in `lib/utils.ts`. Only `MEDUSA_BACKEND_URL` and `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` are required.

## Medusa Backend

Lives at `backend/` within this monorepo. Uses PostgreSQL 17 with `medusa_db` database. Part of the bun workspace monorepo.

### Starting

```bash
brew services start postgresql@17          # 1. Start PostgreSQL
cd backend && bun run dev                  # 2. Start Medusa (port 9000)
cd storefront && bun dev                   # 3. Start storefront (port 3000)
# Or from root: bun run dev               # Start both in parallel
```

### Stopping

```bash
# Ctrl+C in storefront terminal
# Ctrl+C in Medusa terminal
brew services stop postgresql@17            # Optional
```

### Admin

Dashboard at `http://localhost:9000/app`. Manages products, collections, orders, regions, settings.

### Useful Commands

```bash
cd backend
bun run dev                                                  # Start dev server
bunx medusa db:migrate                                       # Run pending migrations
bunx medusa db:generate <module-name>                        # Generate migration for custom module
bunx medusa user -e admin@example.com -p password            # Create admin user
```

### Retrieving the Publishable API Key

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
psql medusa_db -t -c "SELECT token FROM api_key WHERE type = 'publishable' LIMIT 1;"
```

## Testing Infrastructure

**Configured:**

- **Playwright** 1.56.x — E2E testing (`cd storefront && bunx playwright test`)
  - Chromium + Firefox (2 browsers × 40 tests = 80 runs)
  - Custom fixtures for API, auth, and wishlist setup
  - Retries enabled (2) to handle Turbopack dev server flakiness
  - 10 spec files covering: guest, authenticated, heart-button, heart-state, sharing, import, transfer, nav-badge, rename-delete, social-proof

**Not yet configured:**

- **Vitest** 4.x — Unit testing (`bun run test:unit`)
- **Testing Library** — React component testing (`@testing-library/react`, `@testing-library/jest-dom`)
- **happy-dom** — Lightweight DOM implementation for Vitest

## Common Pitfalls

1. **Cart not updating:** Both `revalidateTag(TAGS.cart, "max")` AND `revalidatePath("/", "layout")` are required. Missing either causes stale UI.

2. **Products not showing:** Medusa backend must be running with at least one region configured.

3. **Prices showing $0.00:** Products need `calculated_price` — ensure `region_id` is passed in API queries.

4. **Price amounts are NOT in cents:** Medusa v2 stores all prices in major currency units (10 = $10.00). This applies to product prices, cart totals, and shipping option amounts. Never divide by 100 — `toMoney()`, `formatMoney()`, and `Intl.NumberFormat` receive amounts as-is.

5. **Cart subtotal includes shipping:** Medusa v2's `cart.subtotal` = `item_subtotal` + `shipping_subtotal`. For an items-only subtotal (what customers expect to see labeled "Subtotal"), use `cart.item_subtotal`. Our `transformCart()` maps `cost.subtotalAmount` to `cart.item_subtotal` for this reason.

6. **Stale prices after transform changes:** Clear the Next.js cache (`rm -rf .next`) and restart dev.

7. **Color variants not displaying:** Variants must have a "Color" option (case-insensitive match).

8. **Navigation empty:** Falls back to `DEFAULT_NAVIGATION` from `lib/constants/navigation.ts`. This is expected when no collections exist in Medusa.

9. **Build failures:** Usually missing env vars or Medusa backend unreachable.

10. **Pages returning empty:** Medusa has no native CMS. `getPage()` / `getPages()` return stubs.

## TypeScript Configuration

| Setting                    | Value    | Effect                                                                  |
| -------------------------- | -------- | ----------------------------------------------------------------------- |
| `strict`                   | `true`   | All strict checks enabled                                               |
| `noUncheckedIndexedAccess` | `true`   | Array/object access requires null checks                                |
| `baseUrl`                  | `"."`    | Absolute imports from project root (`import { Cart } from 'lib/types'`) |
| `target`                   | `ES2022` | Output target                                                           |
| `moduleResolution`         | `Bundler`| Bundler-style module resolution                                         |

## Image Optimization

Remote patterns configured in `next.config.ts`:

| Hostname                                          | Purpose                     |
| ------------------------------------------------- | --------------------------- |
| `localhost`                                       | Local Medusa backend images |
| `medusa-public-images.s3.eu-west-1.amazonaws.com` | Medusa hosted images        |
| `medusa-server-testing.s3.amazonaws.com`          | Medusa testing images       |
| `via.placeholder.com`                             | Placeholder images          |
| `tailwindcss.com`                                 | Tailwind UI demo assets     |

Formats: AVIF and WebP.

## Review Guidelines

### P0 — Security
- All server actions must validate and sanitize input before processing
- Cookie operations must use the dedicated functions in `lib/medusa/cookies.ts` — never set cookies directly
- Cookies must use httpOnly, sameSite strict, and secure (in production) flags
- No sensitive data (cart IDs, customer info, payment sessions, JWT tokens) exposed in client components or client-side code
  - **Exception:** Stripe Payment Element requires `client_secret` on the client, and cart IDs in payment callback URLs are needed for redirect-based flows (3D Secure, PayPal). Server actions validate cart ownership via `assertSessionCart()`.
- No API keys, secrets, or tokens in client bundles — check for `NEXT_PUBLIC_` prefix misuse
- Server actions handling cart/checkout mutations must enforce authentication where required via `getAuthHeaders()`
- Payment flows must not be manipulable — no client-controlled pricing, no cart state injection, no replay vectors
- All customer-facing API routes must validate the requesting user owns the resource (prevent IDOR)
- Never trust Stripe `redirect_status` or client-side payment intent status — always validate server-side via `completeCart()`
- `STRIPE_WEBHOOK_SECRET` must be set whenever `STRIPE_API_KEY` is configured — flag if webhook verification is missing or bypassed
- Express checkout flows must validate email presence before proceeding to payment
- Non-terminal payment statuses (e.g., "processing", "requires_action") must surface user-facing errors — never silently no-op or swallow the status

### P0 — Correctness
- Cart mutations must call both `revalidateTag(TAGS.cart, "max")` AND `revalidatePath("/", "layout")` — missing either causes stale UI
- Cart revalidation must run in `finally` blocks so optimistic state re-syncs even on failure
- Medusa v2 prices are in major currency units (10 = $10.00) — never divide by 100
- Cart subtotal for display must use `item_subtotal` not `subtotal` (which includes shipping)
- API calls fetching product prices or variants must include `region_id` for calculated prices
- Error handling must use `medusaError()` from `lib/medusa/error.ts` — not raw try/catch with generic messages

### P1 — Architecture
- Client components must be limited to interactive needs (dialogs, optimistic updates, keyboard shortcuts) — default to RSC
- Server actions must follow the established pattern in `components/cart/actions.ts`
- No new `any` types in changed files — existing `any` usage in legacy files (order confirmation, checkout types) is tracked separately

### P1 — Maintainability
- Functions exceeding 80 lines should be flagged for review — procedural flows like checkout handlers may be acceptable if linear and well-commented
- Duplicated logic across server actions should use shared helpers
- Consistent error handling patterns across all server actions
- TypeScript strict mode compliance — no unchecked index access
