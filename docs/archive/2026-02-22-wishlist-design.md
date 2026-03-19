# Wishlist Feature Design

**Date:** 2026-02-22
**Status:** Approved

## Summary

Full wishlist system spanning all 4 layers: backend module, API routes, storefront server actions, and UI components. Supports guest wishlists with cookie-based tracking and transfer on login, multiple named wishlists per customer, JWT-based sharing, and variant-level tracking.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tracking level | Variant (`product_variant_id`) | Matches Medusa tutorial and all reference implementations |
| Guest support | Cookie-based with transfer on login | Follows alphabite pattern; mirrors existing cart guest flow |
| Multiple wishlists | Named wishlists for customers; single for guests | Guest enforcement in workflow logic, not data model |
| Sharing | JWT tokens, 7-day expiry, import/clone | Follows tutorial + alphabite; expired tokens return 410 with friendly message |
| Add to cart | Copy (keep in wishlist) | Frontend composition — calls existing `addItem` with variant ID |
| Architecture | Built-in module in `backend/src/modules/wishlist/` | Matches product-review module pattern; avoids plugin tooling overhead |

## References

- **Primary:** [Medusa Wishlist Tutorial](https://docs.medusajs.com/resources/plugins/guides/wishlist) (with bug fix for GitHub #11550: no `throwIfKeyNotFound` on `customer_id` filters)
- **Architecture:** [@alphabite/medusa-wishlist](https://github.com/alphabite-dev/medusa-wishlist) — guest support, transfer, multiple wishlists
- **Storefront:** [@godscodes/medusa-wishlist-plugin](https://github.com/godscodes/medusajs-wishlist-plugin) — server actions, SDK patterns
- **TailwindUI:** Component catalog at `/Users/itsjusteric/CrowCommerce/Resources/TailwindUI/tailwindplus-components.json`

## Section 1: Data Model & Module

### Module: `backend/src/modules/wishlist/`

**Wishlist model:**

| Field | Type | Notes |
|---|---|---|
| `id` | primary key, prefix `wl` | ULID — 128 bits entropy, unguessable |
| `name` | text, nullable | Named wishlists for customers; null for guests |
| `customer_id` | text, **nullable** | Null = guest wishlist |
| `sales_channel_id` | text, required | Scoped to sales channel |
| `items` | hasMany → WishlistItem | |

Index: non-unique on `(customer_id, sales_channel_id)` where `customer_id IS NOT NULL`. Allows multiple wishlists per customer. Guest single-wishlist behavior enforced in workflow logic, not schema.

**WishlistItem model:**

| Field | Type | Notes |
|---|---|---|
| `id` | primary key, prefix `wli` | |
| `product_variant_id` | text, required | Variant-level tracking |
| `wishlist` | belongsTo → Wishlist | |

Unique index on `(product_variant_id, wishlist_id)` — no duplicate variants per wishlist.

**Module links** (all `readOnly: true`):
- `wishlist.customer_id` → `Customer`
- `wishlist.sales_channel_id` → `SalesChannel`
- `wishlistItem.product_variant_id` → `ProductVariant`

**Service:** `WishlistModuleService extends MedusaService({ Wishlist, WishlistItem })` with custom `getWishlistsOfVariants(variantIds)` for admin widget count.

**Bug avoidance:** All validation steps use `if (!wishlists?.length)` instead of `throwIfKeyNotFound: true` on `customer_id` filters (Medusa GitHub #11550).

## Section 2: API Routes

### Customer Routes (authenticated)

| Method | Route | Body | Description |
|---|---|---|---|
| `GET` | `/store/customers/me/wishlists` | — | List all customer wishlists |
| `POST` | `/store/customers/me/wishlists` | `{ name?: string }` | Create named wishlist |
| `PUT` | `/store/customers/me/wishlists/:id` | `{ name?: string }` | Rename wishlist |
| `DELETE` | `/store/customers/me/wishlists/:id` | — | Delete wishlist |
| `POST` | `/store/customers/me/wishlists/:id/items` | `{ variant_id: string }` | Add variant |
| `DELETE` | `/store/customers/me/wishlists/:id/items/:itemId` | — | Remove item |
| `POST` | `/store/customers/me/wishlists/:id/share` | — | Generate JWT share token |
| `POST` | `/store/customers/me/wishlists/:id/transfer` | — | Transfer guest wishlist to customer |

### Guest Routes (unauthenticated, `allowUnauthenticated: true`)

| Method | Route | Body | Description |
|---|---|---|---|
| `POST` | `/store/wishlists` | — | Create guest wishlist |
| `GET` | `/store/wishlists/:id` | — | Get wishlist by ID |
| `POST` | `/store/wishlists/:id/items` | `{ variant_id: string }` | Add variant to guest wishlist |
| `DELETE` | `/store/wishlists/:id/items/:itemId` | — | Remove item |

**Security note:** Guest wishlists accessed by ULID (`wl_` prefix, 128-bit entropy). Same unguessable-ID model as cart cookies. No enumeration risk in practice.

### Shared/Public Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/store/wishlists/shared/:token` | View shared wishlist (expired tokens → 410 with friendly message) |
| `POST` | `/store/wishlists/import` | Clone shared wishlist (body: `{ share_token: string }`) |

### Product Route

| Method | Route | Description |
|---|---|---|
| `GET` | `/store/products/:id/wishlist` | Count of wishlists containing this product |

**Middleware:** Zod validation via `validateAndTransformBody` on all POST/PUT routes with bodies. Auth uses `authenticate("customer", ["bearer"])` with `allowUnauthenticated: true` on guest routes.

## Section 3: Workflows

### `create-wishlist`

Input: `{ customer_id?: string, sales_channel_id: string, name?: string }`

1. If customer: validate customer exists
2. If guest: no validation
3. `createWishlistStep` (compensation: delete)
4. Return `{ wishlist }`

### `create-wishlist-item`

Input: `{ variant_id: string, wishlist_id: string, sales_channel_id: string }`

1. Fetch wishlist with items (`useQueryGraphStep`)
2. `validateWishlistExistsStep` — `if (!wishlists?.length)` check
3. `validateWishlistSalesChannelStep` — wishlist matches request's sales channel
4. `validateVariantWishlistStep` — not duplicate + available in sales channel
5. `createWishlistItemStep` (compensation: delete)
6. Refetch with expanded variant data
7. Return `{ wishlist }`

### `delete-wishlist-item`

Input: `{ wishlist_item_id: string, wishlist_id: string }`

1. Fetch wishlist with items
2. `validateWishlistExistsStep`
3. `validateItemInWishlistStep`
4. `deleteWishlistItemStep` — soft-delete (compensation: restore)
5. Refetch wishlist
6. Return `{ wishlist }`

### `delete-wishlist`

Input: `{ wishlist_id: string, customer_id: string }`

1. Validate wishlist belongs to customer
2. `deleteWishlistStep` — soft-delete + cascade (compensation: restore)
3. Return `{ success: true }`

### `update-wishlist`

Input: `{ wishlist_id: string, customer_id: string, name?: string }`

1. Validate ownership
2. `updateWishlistStep` (compensation: revert)
3. Return `{ wishlist }`

### `transfer-wishlist`

Input: `{ wishlist_id: string, customer_id: string }`

1. Validate wishlist has `customer_id: null` (is a guest wishlist)
2. `validateWishlistSalesChannelStep` — guest wishlist's sales channel is in publishable key's `sales_channel_ids` (single-sales-channel assumption noted in comment)
3. `transferWishlistStep` — set `customer_id` (compensation: set back to null)
4. Emit `wishlist.transferred` event
5. Return `{ wishlist }`

**No merge logic** — transferred guest wishlist becomes an additional wishlist for the customer.

### `share-wishlist`

Input: `{ wishlist_id: string, customer_id: string }`

1. Validate ownership
2. Generate JWT with `wishlist_id`, signed with Medusa `jwtSecret`, 7-day expiry
3. Return `{ token }`

Viewing and importing shared wishlists are direct query/service calls in route handlers (read-only, no compensation needed).

## Section 4: Storefront Data Layer

### Cookie (`storefront/lib/medusa/cookies.ts`)

New: `_medusa_wishlist_id` — 30-day, httpOnly, sameSite strict, secure in prod.
Functions: `getWishlistId()`, `setWishlistId(id)`, `removeWishlistId()`

### Cache Tags (`storefront/lib/constants.ts`)

Add `wishlists: "wishlists"` to `TAGS`.

### Types (`storefront/lib/types.ts`)

```ts
type Wishlist = {
  id: string;
  name: string | null;
  customer_id: string | null;
  sales_channel_id: string;
  items: WishlistItem[];
  created_at: string;
  updated_at: string;
};

type WishlistItem = {
  id: string;
  product_variant_id: string;
  wishlist_id: string;
  product_variant?: {
    id: string;
    title: string;
    sku: string;
    product_id: string;
    product?: Product;
  };
  created_at: string;
};
```

### Server Actions (`storefront/lib/medusa/wishlist.ts`)

All follow existing pattern: `"use server"`, `getAuthHeaders()`, `sdk.client.fetch()`, `medusaError()`, `revalidateTag(TAGS.wishlists, "max")` + `revalidatePath("/", "layout")` in `finally`.

**Read (cached with `"use cache"`):**
- `getWishlists()` — customer: all wishlists; guest: single by cookie ID. Returns `Wishlist[] | null`
- `getWishlist(wishlistId)` — specific wishlist with items + variant data
- `getSharedWishlist(token)` — shared wishlist by JWT
- `isVariantInWishlist(variantId)` — checks across all wishlists. Returns `boolean`
- `getWishlistItemCount()` — total items for nav badge

**Mutations (return `{ error?: string; success?: boolean } | null`):**
- `createWishlist(prevState, formData)` — named (customer) or guest (stores ID in cookie)
- `addToWishlist(prevState, formData)` — optional `wishlist_id`: if omitted and customer has exactly one wishlist, auto-targets it; if multiple, returns `{ error: "Please select a wishlist" }`
- `removeFromWishlist(prevState, formData)` — by `wishlist_item_id`
- `deleteWishlist(prevState, formData)` — by ID
- `renameWishlist(prevState, formData)` — update name
- `transferWishlist()` — reads cookie, POSTs transfer, clears cookie
- `shareWishlist(wishlistId)` — returns share token/URL

### Auth Integration (`storefront/lib/medusa/customer.ts`)

In `login()` and `signup()`, after `transferCart()`: call `transferWishlist()`. Fire and forget — errors swallowed so transfer failure doesn't block login.

## Section 5: UI Components

### Heart Toggle (`storefront/components/wishlist/wishlist-button.tsx`)

`"use client"` — used on product cards and PDP.

- Props: `variantId`, `productId`, optional `wishlistId`
- Filled heart (solid) = in wishlist, outline = not
- Click toggles add/remove
- Guest: lazily creates guest wishlist on first add
- Customer with 1 wishlist: single click
- Customer with 2+ wishlists: pre-selects most recently modified; dropdown arrow for picker
- `useNotification()` for success/error feedback
- TailwindUI ref: `Ecommerce > Components > Product Overviews > With image gallery and expandable details`

### Product Card Heart Overlay

Top-right corner of product card image. Small circular button.
- TailwindUI ref: `Application UI > Overlays > Drawers > File details example` (circular icon button pattern)

### Product Detail Page

Heart button next to "Add to bag". Wishlist picker dropdown only when 2+ wishlists.
- TailwindUI ref: `Application UI > Elements > Dropdowns > With icons`

### Wishlist Page (`storefront/app/(store)/account/wishlist/page.tsx`)

Under guarded account routes.

- Multiple wishlists: tab navigation with item count badges + "New Wishlist" button
- Product grid per wishlist with image, name, variant, price
- "Add to cart" button per item (calls existing `addItem` — copy, not move)
- Remove button per item
- Share button per wishlist (generates link, copies to clipboard)
- TailwindUI refs:
  - Grid: `Ecommerce > Components > Product Lists > With image overlay and add button`
  - Empty state: `Application UI > Feedback > Empty States > Simple` (HeartIcon, "No saved items yet", "Browse products")
  - Tabs: `Application UI > Navigation > Tabs > Tabs with underline and badges`

### Account Navigation

Add `{ name: "Wishlist", href: "/account/wishlist" }` to `account-tabs.tsx`.

### Nav Badge

Heart icon in header with count indicator. Uses cached `getWishlistItemCount()`.

### Shared Wishlist Page (`storefront/app/(store)/wishlist/shared/[token]/page.tsx`)

Public (no auth guard). Read-only product grid. "Import to my wishlist" button for authenticated users. Expired token: "This wishlist link has expired. Ask the owner to share a new link."

### Guest Flow

Heart clicks on product cards/PDP silently create/update guest wishlist. Visiting `/account/wishlist` hits auth guard → login page. On login, `transferWishlist()` runs automatically.
