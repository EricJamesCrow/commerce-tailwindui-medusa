# Personalized Products — Design Spec

**Date:** 2026-03-25
**Status:** Approved
**Reference:** [Medusa Personalized Products Recipe](https://docs.medusajs.com/resources/recipes/personalized-products/example)

---

## Overview

Implement the Medusa personalized products reference pattern. Products can be flagged as personalized via the `is_personalized` metadata flag in the admin. When a customer visits a personalized product page, they enter custom dimensions (height × width in cm). The price updates dynamically based on a linear formula. The personalization data is stored in line item metadata and flows through to orders and the admin dashboard.

This is a reference implementation intended to be adapted per client. All business logic (pricing formula, field labels, validation rules) is localized in clearly identified constants and steps.

---

## Architecture

```text
Storefront                           Backend
─────────────────────────────────    ─────────────────────────────────────────
ProductDetail
  └─ dimension inputs (h × w)   ──►  POST /store/variants/:id/price
  └─ live price display                 └─ getCustomPriceWorkflow
                                              ├─ useQueryGraphStep (region → currency)
                                              ├─ useQueryGraphStep (variant → base price)
                                              └─ getCustomPriceStep (apply formula)

  addPersonalizedItem() direct call ► POST /store/carts/:id/line-items-custom
  (NOT via useActionState)               └─ customAddToCartWorkflow
                                              ├─ useQueryGraphStep (cart → region)
                                              ├─ getCustomPriceWorkflow (sub-workflow)
                                              ├─ acquireLockStep({ keys: [cartId] })
                                              ├─ addLineItemsStep (from core-flows)
                                              └─ releaseLockStep({ keys: [cartId] })

                                     addToCartWorkflow.hooks.validate (global)
                                       └─ enforce height/width present + numeric
                                            on any personalized product

Cart item display (item.metadata)
  └─ Width: Xcm / Height: Xcm

Order confirmation + account orders
  └─ same metadata display

                                     Admin widget (order.details.after)
                                       └─ personalized items table
```

---

## Backend

### Pricing constant

```text
DIMENSION_PRICE_FACTOR = 0.01
customPrice = basePrice + (height × width × DIMENSION_PRICE_FACTOR)
```

Defined as a named constant at the top of `get-custom-price.ts` — single location to update per client.

### Key imports

```ts
// Workflows
import { createWorkflow, createStep, useQueryGraphStep, transform } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { addToCartWorkflow, addLineItemsStep } from "@medusajs/medusa/core-flows"
import { acquireLockStep, releaseLockStep } from "@medusajs/core-flows"

// API routes
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validateAndTransformBody } from "@medusajs/medusa"
import { z } from "zod"

// Admin widget
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container } from "@medusajs/ui"
```

### Workflow: `getCustomPriceWorkflow`

File: `backend/src/workflows/get-custom-price.ts`

```text
Input:  { variantId: string, regionId: string, metadata: { height: number, width: number } }
Output: { amount: number, currency_code: string }
```

Steps:
1. `useQueryGraphStep` — query `region` entity with `fields: ["currency_code"]`, filter `{ id: regionId }`. Extract `currency_code`.
2. `useQueryGraphStep` — query `variant` entity with `fields: ["calculated_price.*"]`, filter `{ id: variantId }`, context `{ region_id: regionId, currency_code }`. Extract `calculated_amount` (**main currency unit** — e.g., `10` = $10.00, matching Medusa v2 convention; NOT cents).
3. `getCustomPriceStep` — takes `{ baseAmount, height, width }`, computes `baseAmount + (height * width * DIMENSION_PRICE_FACTOR)` (all in main currency unit, no integer rounding needed), returns `{ amount, currency_code }`.

### Workflow: `customAddToCartWorkflow`

File: `backend/src/workflows/custom-add-to-cart.ts`

```text
Input:  { cartId: string, variantId: string, quantity: number, metadata: Record<string, unknown> }
Output: { cart: StoreCart }
```

Steps:
1. `useQueryGraphStep` — query `cart` entity, fields `["region_id"]`, filter `{ id: cartId }`. Extract `region_id`.
2. Call `getCustomPriceWorkflow` as a nested step via `getCustomPriceWorkflow.runAsStep({ input: { variantId, regionId: region_id, metadata } })`.
3. `acquireLockStep({ keys: [cartId], timeout: 2000, ttl: 10000 })`.
4. `transform` to build line item input: `{ cart_id: cartId, items: [{ variant_id: variantId, quantity, unit_price: customPrice.amount, metadata }] }`.
5. `addLineItemsStep` (imported from `@medusajs/medusa/core-flows`) — adds the line item with the custom price.
6. `releaseLockStep({ keys: [cartId] })`.
7. `useQueryGraphStep` — re-fetch full cart to return updated state.

**Hook registration (same file):**

```ts
addToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  for (const item of input.items ?? []) {
    const meta = item.metadata as Record<string, unknown> | undefined
    if (meta?.is_personalized) {
      const h = Number(meta.height)
      const w = Number(meta.width)
      if (!h || !w || isNaN(h) || isNaN(w) || h <= 0 || w <= 0) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Please set height and width metadata for each item."
        )
      }
    }
  }
})
```

This hook is registered as a side effect when `custom-add-to-cart.ts` is loaded. Medusa auto-loads all files in the `workflows/` directory at server start, so this hook is active globally — it applies to any code path that runs `addToCartWorkflow`, including both the custom and standard endpoints. This is belt-and-suspenders: the custom endpoint is the primary path for personalized products, but the hook prevents bypassing validation via the standard endpoint.

### API route: `POST /store/variants/:id/price`

File: `backend/src/api/store/variants/[id]/price/route.ts`

Zod schema:
```ts
const PostVariantPriceSchema = z.object({
  region_id: z.string(),
  metadata: z.object({ height: z.number().positive(), width: z.number().positive() }),
})
```

Middleware: `validateAndTransformBody(PostVariantPriceSchema)` applied in `backend/src/api/middlewares.ts`.

Handler: runs `getCustomPriceWorkflow({ variantId: req.params.id, regionId: body.region_id, metadata: body.metadata })`. Returns `{ amount: number, currency_code: string }` directly from workflow output. **Amount is in the main currency unit (for example, `10` = `$10.00`).**

### API route: `POST /store/carts/:id/line-items-custom`

File: `backend/src/api/store/carts/[id]/line-items-custom/route.ts`

Zod schema:
```ts
const PostCustomLineItemSchema = z.object({
  variant_id: z.string(),
  quantity: z.number().int().positive().optional().default(1),
  metadata: z.object({ height: z.number().positive(), width: z.number().positive() }).passthrough(),
})
```

Middleware: `validateAndTransformBody(PostCustomLineItemSchema)` in `backend/src/api/middlewares.ts`.

Handler: runs `customAddToCartWorkflow({ cartId: req.params.id, variantId: body.variant_id, quantity: body.quantity, metadata: body.metadata })`. Returns updated cart.

### Admin widget: `PersonalizedOrderItemsWidget`

File: `backend/src/admin/widgets/order-personalized.tsx`

```ts
export const config = defineWidgetConfig({ zone: "order.details.after" })
```

- Props: `{ data: AdminOrder }` (Medusa admin widget prop shape)
- Filter: `data.items?.filter(item => item.metadata?.is_personalized === true)`
- If no personalized items: `return null`
- If items found: render a `@medusajs/ui` `Container` with a heading and a table. Each row shows: product thumbnail (or placeholder), product title, `Width: {item.metadata.width}cm`, `Height: {item.metadata.height}cm`

---

## Storefront

### Type changes

File: `storefront/lib/types.ts`

```ts
// Add to Product type:
metadata?: Record<string, unknown>

// Add to CartItem type (top level, NOT inside merchandise):
metadata?: Record<string, unknown>
```

**Important:** `metadata` goes on `CartItem` directly (mirroring Medusa's `lineItem.metadata`), not on `CartItem.merchandise`. Cart display reads `item.metadata?.is_personalized`.

### Transforms

File: `storefront/lib/medusa/transforms.ts`

`transformProduct`: add `metadata: product.metadata ?? undefined` to the returned object.

Cart line item transform (wherever `CartItem` is built from a raw Medusa line item): add `metadata: lineItem.metadata ?? undefined` to the returned `CartItem`. This is likely in `transformCart` or an inline mapping in `fetchCart`.

Verify the cart query includes `+metadata` in the fields string for line items (add `+items.metadata` if not present).

### Lib: `storefront/lib/medusa/index.ts`

**New function:**

```ts
export async function getCustomVariantPrice(
  variantId: string,
  regionId: string,
  metadata: { height: number; width: number }
): Promise<{ amount: string; currency_code: string }> {
  const res = await sdk.client.fetch<{ amount: number; currency_code: string }>(
    `/store/variants/${variantId}/price`,
    { method: "POST", body: { region_id: regionId, metadata } }
  )
  // Medusa v2 amounts are in the main currency unit (e.g. 10 = $10.00) — no division needed.
  // Use .toFixed(2) to match the Money convention used by toMoney() in transforms.ts.
  return { amount: res.amount.toFixed(2), currency_code: res.currency_code }
}
```

**Modified `addToCart`:**

The `lines` param gains `metadata?: Record<string, unknown>` per line:
```ts
lines: { merchandiseId: string; quantity: number; metadata?: Record<string, unknown> }[]
```

When `metadata` is present for a line: POST to `/store/carts/${cartId}/line-items-custom` with `{ variant_id, quantity, metadata }` (using `sdk.client.fetch`). Lines without metadata continue to use `sdk.store.cart.createLineItem` as before.

### Server actions: `storefront/components/cart/actions.ts`

**Existing `addItem` is unchanged.** The `useActionState` signature stays as-is.

**New action:**
```ts
export async function addPersonalizedItem(
  variantId: string,
  metadata: { height: number; width: number; is_personalized: true }
): Promise<CartActionState> {
  try {
    await addToCart([{ merchandiseId: variantId, quantity: 1, metadata }])
    return null
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "add_personalized_item" } })
    return e instanceof Error ? e.message : "Error adding item to cart"
  } finally {
    revalidateCart() // private helper in actions.ts — already accessible in this file
  }
}
```

This action is called **directly** (not via `useActionState`) from `ProductDetail` when the product is personalized. The `try/catch/finally` mirrors the pattern in `addItem` — errors are returned as strings (never thrown), matching `CartActionState = string | null`.

### Component: `storefront/components/product/product-detail.tsx`

Add state: `const [height, setHeight] = useState<number | "">("")` and `const [width, setWidth] = useState<number | "">("")`.
Add state: `const [customPrice, setCustomPrice] = useState<{ amount: string; currency_code: string } | null>(null)`.
Add state: `const [addError, setAddError] = useState<string | null>(null)`.

**Price fetching — debounced inside a React `useEffect` (browser client component, NOT a workflow):**

This runs in the browser via `useEffect` in `product-detail.tsx` (`'use client'`). Use the standard React debounce pattern: schedule the async fetch with a 300ms delay using a numeric timer handle stored in a `useRef`. Return a cleanup function from `useEffect` that cancels the pending timer. This ensures only the final value in a rapid-input sequence triggers a network request.

Dependencies: `[height, width, selectedVariant, sourceProduct.metadata?.is_personalized]`

Inside the delayed callback:
- Guard: skip if `!height || !width || !selectedVariant`
- Call `getDefaultRegion()` then `getCustomVariantPrice(variantId, regionId, { height, width })`
- On success: `setCustomPrice(price)` + `trackClient("personalized_price_calculated", ...)`
- On error: `Sentry.captureException(err)` + `setCustomPrice(null)` (fall back to base price)
**Render (when `sourceProduct.metadata?.is_personalized`):**
- Two `<input type="number" min="0.1" step="0.1">` fields for Height and Width (labeled in cm)
- Pass `customPrice?.amount ?? selectedVariant?.price.amount` and `customPrice?.currency_code ?? selectedVariant?.price.currencyCode` to `ProductDetailPrice`
- The Add to Cart button is disabled unless `height > 0 && width > 0 && selectedVariant`

**Add to cart handler (personalized path):**
```ts
const handlePersonalizedAddToCart = async () => {
  if (!selectedVariant || !height || !width) return
  setAddError(null)
  const err = await addPersonalizedItem(selectedVariant.id, {
    height: Number(height),
    width: Number(width),
    is_personalized: true,
  })
  if (err) setAddError(err)
  else {
    addCartItem(...) // update local cart context optimistically if needed
    trackClient("personalized_product_added_to_cart", { variant_id: selectedVariant.id, height: Number(height), width: Number(width), price: Number(customPrice?.amount ?? 0) })
  }
}
```

Non-personalized products: zero changes to existing render path.

### Component: Cart item display

File: `storefront/components/cart/index.tsx`

After the existing variant option display, add:
```tsx
{item.metadata?.is_personalized && (
  <p className="mt-1 text-sm text-gray-500">
    Width: {String(item.metadata.width)}cm · Height: {String(item.metadata.height)}cm
  </p>
)}
```

`item.metadata` is at the top level of `CartItem` (not inside `merchandise`).

### Component: Order item display

Two files need this same conditional block after the variant title display:

```tsx
{item.metadata?.is_personalized && (
  <p className="mt-1 text-sm text-gray-500">
    Width: {String(item.metadata.width)}cm · Height: {String(item.metadata.height)}cm
  </p>
)}
```

**File 1:** `storefront/app/order/confirmed/[orderId]/page.tsx` — line items rendered at ~line 118 via `order.items.map`. `item` here is `NonNullable<StoreOrder["items"]>[number]` from Medusa types; `item.metadata` is already on the raw type.

**File 2:** `storefront/components/account/order-detail.tsx` — line items rendered at ~line 226 via `order.items?.map`.

No type changes needed for these two files — they use raw Medusa `StoreOrder` / `StoreOrderLineItem` types which already include `metadata?: Record<string, unknown>`.

---

## Data Contract: `is_personalized` in line item metadata

The `is_personalized: true` flag is set by the **storefront** in the metadata passed to `addPersonalizedItem`. It is NOT injected by the backend. This means:

- Backend validation hook checks for `is_personalized` flag and validates height/width only when it's present
- Admin widget filters on `item.metadata?.is_personalized === true`
- If someone calls the custom endpoint without `is_personalized: true`, the admin widget won't show that item — this is acceptable because the only caller of the custom endpoint is the personalized product UI

To harden this in future: the backend custom-add-to-cart route could inject `is_personalized: true` into the metadata server-side regardless of what the storefront sends.

---

## Analytics Events

Add to `AnalyticsEvents` type map before use:

| Event | Where | Properties |
|---|---|---|
| `personalized_price_calculated` | `ProductDetail` (client) | `variant_id: string`, `height: number`, `width: number`, `calculated_price: number` |
| `personalized_product_added_to_cart` | `ProductDetail` (client) | `variant_id: string`, `height: number`, `width: number`, `price: number` |

---

## Error Handling

| Scenario | Handling |
|---|---|
| Price fetch fails (network/backend) | Catch in `useEffect`, call `Sentry.captureException`, `setCustomPrice(null)` → show base price |
| Add to cart fails (backend validation) | `addPersonalizedItem` returns error string → show in `addError` state |
| Dimensions are 0 or negative | Button disabled client-side; `min="0.1"` on inputs |
| Backend unavailable | Same as price fetch fail — silent fallback to base price |

---

## Testing

- **Unit:** `getCustomPriceStep` — base=10.00 (main unit, e.g. $10.00), h=10, w=5 → expected=10.50 (10.00 + 10×5×0.01)
- **Integration:** `POST /store/variants/:id/price` valid region + metadata → assert `amount` matches formula
- **Integration:** `POST /store/carts/:id/line-items-custom` → assert cart line item carries `metadata.height`, `metadata.width`, `metadata.is_personalized`
- **Validation:** `POST /store/carts/:id/line-items-custom` with `is_personalized: true` but no dimensions → expect 400 `INVALID_DATA`
- **Storefront unit:** `getCustomVariantPrice` — mock `sdk.client.fetch` returning `{ amount: 10.5, currency_code: "usd" }` → assert returns `{ amount: "10.50", currency_code: "usd" }`

---

## Subagent Parallelism

Two independent tracks can run in parallel in separate git worktrees. The API contract (endpoint shapes, amount in main currency units) is fixed in this spec.

**Track A — Backend** (files: all in `backend/`)
- `backend/src/workflows/get-custom-price.ts`
- `backend/src/workflows/custom-add-to-cart.ts` (includes hook registration)
- `backend/src/api/store/variants/[id]/price/route.ts`
- `backend/src/api/store/carts/[id]/line-items-custom/route.ts`
- Middleware entries in `backend/src/api/middlewares.ts`
- `backend/src/admin/widgets/order-personalized.tsx`

**Track B — Storefront** (files: all in `storefront/`)
- `storefront/lib/types.ts`
- `storefront/lib/medusa/transforms.ts`
- `storefront/lib/medusa/index.ts`
- `storefront/components/cart/actions.ts`
- `storefront/components/product/product-detail.tsx`
- `storefront/components/cart/index.tsx`
- `storefront/app/order/confirmed/[orderId]/page.tsx`
- `storefront/components/account/order-detail.tsx`
- Analytics type map (wherever `AnalyticsEvents` is defined)

---

## Files Created / Modified

### New files
- `backend/src/workflows/get-custom-price.ts`
- `backend/src/workflows/custom-add-to-cart.ts`
- `backend/src/api/store/variants/[id]/price/route.ts`
- `backend/src/api/store/carts/[id]/line-items-custom/route.ts`
- `backend/src/admin/widgets/order-personalized.tsx`

### Modified files
- `backend/src/api/middlewares.ts` — add Zod middleware for both new routes
- `storefront/lib/types.ts` — add `metadata` to `Product` (top-level) and `CartItem` (top-level)
- `storefront/lib/medusa/transforms.ts` — thread metadata through product and cart transforms
- `storefront/lib/medusa/index.ts` — add `getCustomVariantPrice`, extend `addToCart` lines type
- `storefront/components/cart/actions.ts` — add `addPersonalizedItem` action
- `storefront/components/product/product-detail.tsx` — dimension inputs + dynamic price + personalized add-to-cart handler
- `storefront/components/cart/index.tsx` — metadata display on cart items
- `storefront/app/order/confirmed/[orderId]/page.tsx` — metadata display on order items
- `storefront/components/account/order-detail.tsx` — metadata display on order items
- Analytics type map file — add `personalized_price_calculated` and `personalized_product_added_to_cart` events
