# Medusa.js Integration Design

**Date:** 2026-02-18
**Status:** Approved
**Scope:** Replace Shopify with Medusa.js as the commerce backend (Phase 1: Catalog + Cart)

## Decisions

- **Single region** — no `[countryCode]` URL routing. Default region set via environment variable.
- **Catalog + cart only** — checkout, customer accounts, and order management deferred to later phases.
- **Thin adapter layer** — `lib/medusa/` exports the same function signatures as `lib/shopify/`. Internal types preserved so components need minimal changes.

## Architecture

### Data Layer (`lib/medusa/`)

```
lib/medusa/
├── index.ts          # SDK client + all exported data-fetching functions
├── types.ts          # Medusa-specific raw types (if needed)
└── transforms.ts     # Medusa → internal type mappings
```

**`lib/types.ts`** (extracted from `lib/shopify/types.ts`):
Backend-agnostic types consumed by all components: `Product`, `Cart`, `CartItem`, `Collection`, `Menu`, `Page`, `Navigation`, `Money`, `Image`, `SEO`, `ProductVariant`, `ProductOption`.

### Exported Functions (`lib/medusa/index.ts`)

Same async function signatures as the current Shopify integration:

| Function                                                | Medusa SDK Call                                                |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `getProduct(handle)`                                    | `sdk.store.product.list({ handle })` → first result            |
| `getProducts({query, sortKey, reverse})`                | `sdk.store.product.list({q, order, ...})`                      |
| `getCollections()`                                      | `sdk.store.collection.list()`                                  |
| `getCollection(handle)`                                 | `sdk.store.collection.list({ handle })` → first result         |
| `getCollectionProducts({collection, sortKey, reverse})` | Fetch collection → get product IDs → fetch products            |
| `getProductRecommendations(productId)`                  | `sdk.store.product.list()` filtered (Medusa lacks native recs) |
| `getCart()`                                             | Read `cartId` cookie → `sdk.store.cart.retrieve(cartId)`       |
| `createCart()`                                          | `sdk.store.cart.create({ region_id })`                         |
| `addToCart(lines)`                                      | `sdk.store.cart.createLineItem(cartId, ...)`                   |
| `removeFromCart(lineIds)`                               | `sdk.store.cart.deleteLineItem(cartId, lineId)`                |
| `updateCart(lines)`                                     | `sdk.store.cart.updateLineItem(cartId, lineId, ...)`           |
| `getNavigation()`                                       | Build from collections or use `DEFAULT_NAVIGATION` fallback    |
| `getPage(handle)` / `getPages()`                        | Return empty/placeholder (no native CMS in Medusa)             |
| `getMenu(handle)`                                       | Build from collections or hardcode                             |

**Caching:** Uses `"use cache"` / `cacheTag()` / `cacheLife()` (Next.js 16 experimental), same as current implementation.

**Region:** Single default region fetched once via `sdk.store.region.list()` and cached.

### Type Mapping (Medusa → Internal)

**Product:**

| Internal field     | Medusa source                                                             |
| ------------------ | ------------------------------------------------------------------------- |
| `id`               | `product.id`                                                              |
| `handle`           | `product.handle`                                                          |
| `title`            | `product.title`                                                           |
| `description`      | `product.description`                                                     |
| `descriptionHtml`  | `product.description` (plain text)                                        |
| `availableForSale` | Derived: `variant.inventory_quantity > 0` or `!variant.manage_inventory`  |
| `options`          | `product.options` → `{id, name, values}`                                  |
| `priceRange`       | Min/max of `variant.calculated_price.calculated_amount`                   |
| `variants`         | Map each → `{id, title, availableForSale, selectedOptions, price: Money}` |
| `images`           | `product.images` → `{url, altText, width, height}`                        |
| `featuredImage`    | `product.thumbnail` or `images[0]`                                        |
| `tags`             | `product.tags`                                                            |
| `seo`              | From `product.metadata` or derived from title/description                 |

**Cart:**

| Internal field        | Medusa source                                           |
| --------------------- | ------------------------------------------------------- |
| `id`                  | `cart.id`                                               |
| `checkoutUrl`         | `""` (deferred)                                         |
| `cost.subtotalAmount` | `cart.subtotal` (convert cents → `Money` string format) |
| `cost.totalAmount`    | `cart.total`                                            |
| `cost.totalTaxAmount` | `cart.tax_total`                                        |
| `lines`               | `cart.items` → map to `CartItem[]`                      |
| `totalQuantity`       | Sum of `item.quantity`                                  |

**Money conversion:** Medusa uses integer cents (e.g., `2999`). Transforms convert to Shopify's string format (`{ amount: "29.99", currencyCode: "USD" }`) that components expect.

**Collection:**

| Internal field | Medusa source                                   |
| -------------- | ----------------------------------------------- |
| `handle`       | `collection.handle`                             |
| `title`        | `collection.title`                              |
| `description`  | `collection.metadata?.description` or `""`      |
| `path`         | `/products/${collection.handle}`                |
| `image`        | `collection.metadata?.image_url` or placeholder |

## Component Changes

### Import path updates only (no logic changes)

**16 files** importing types from `lib/shopify/types` → update to `lib/types`.

**17 files** importing functions from `lib/shopify` → update to `lib/medusa`.

### `lib/utils.ts`

- Rename `transformShopifyProductToTailwind` → `transformProductToTailwind` (etc.)
- Internal logic unchanged (already consumes the internal `Product`/`Collection` types)
- `validateEnvironmentVariables()` checks Medusa env vars instead of Shopify

### `components/cart/actions.ts`

- Same Server Action signatures
- Import from `lib/medusa` instead of `lib/shopify`
- `redirectToCheckout()` → no-op or redirect to `/cart`
- `createCartAndSetCookie()` calls Medusa SDK

### Navigation

- `getNavigation()` builds from Medusa collections or falls back to `DEFAULT_NAVIGATION`
- `NavbarClient` and `NavbarDesktop` unchanged

### Search

- `getProducts({query})` maps to `sdk.store.product.list({ q: query })`
- Search command palette works unchanged

### Pages

- `getPage()` / `getPages()` return empty/placeholder
- `[page]` route handles gracefully with 404

## Environment & Configuration

### New `.env.example`

```
MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...
SITE_NAME=Your Store Name
COMPANY_NAME=Your Company
REVALIDATE_SECRET=your_webhook_secret
```

### `next.config.ts`

- Remove `cdn.shopify.com` from image remote patterns
- Add Medusa image host(s)
- Keep experimental flags

### New dependency

- `@medusajs/js-sdk`

### Files to delete

- `lib/shopify/` (entire directory)

### Files to create

- `lib/medusa/index.ts`
- `lib/medusa/transforms.ts`
- `lib/medusa/types.ts` (optional)
- `lib/types.ts` (extracted from `lib/shopify/types.ts`)

### Webhook revalidation

- `app/api/revalidate/route.ts` → replace Shopify webhook validation with Medusa webhook handling

## Out of Scope (Future Phases)

- Checkout flow (address → shipping → payment → order)
- Customer authentication (login, register, account dashboard)
- Order history and management
- Multi-region / multi-currency support
- Product categories (Medusa's nested category tree)
- Wishlist / favorites
