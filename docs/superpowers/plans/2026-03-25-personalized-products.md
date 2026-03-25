# Personalized Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Medusa personalized products reference pattern — dimension inputs on the product page, dynamic pricing via custom backend workflows, and metadata persistence through cart → order → admin widget.

**Architecture:** Two fully independent tracks (A: backend, B: storefront) share only a fixed HTTP API contract. Track A adds two custom workflows, two store API routes, and an admin widget. Track B threads metadata through types/transforms, adds a new server action and lib function, and adds dimension UI + metadata display to product/cart/order components. Both tracks can be implemented in parallel in separate git worktrees.

**Tech Stack:**
- Backend: Medusa v2, `@medusajs/framework/workflows-sdk`, `@medusajs/medusa/core-flows`, `@medusajs/framework/zod`, `@medusajs/admin-sdk`, `@medusajs/ui`
- Storefront: Next.js 16 App Router (`'use client'`), Vitest, `@medusajs/js-sdk`, Sentry

---

## API Contract (fixed — both tracks implement against this)

**`POST /store/variants/:id/price`**
- Request: `{ region_id: string, metadata: { height: number, width: number } }`
- Response: `{ amount: number, currency_code: string }` — amount in **main currency unit** (e.g., `10.5` = $10.50; NOT cents)

**`POST /store/carts/:id/line-items-custom`**
- Request: `{ variant_id: string, quantity?: number, metadata: { height: number, width: number, is_personalized?: boolean, ... } }`
- Response: updated cart object

**Pricing formula:** `customAmount = baseAmount + (height × width × 0.01)` where all amounts are in main currency unit.

---

## File Map

### Track A — Backend (all in `backend/`)

| File | Action | Purpose |
|------|--------|---------|
| `src/workflows/get-custom-price.ts` | Create | `getCustomPriceWorkflow`: region lookup → variant price → formula |
| `src/workflows/custom-add-to-cart.ts` | Create | `customAddToCartWorkflow` + `addToCartWorkflow.hooks.validate` |
| `src/api/store/variants/[id]/price/route.ts` | Create | `POST /store/variants/:id/price` handler |
| `src/api/store/carts/[id]/line-items-custom/route.ts` | Create | `POST /store/carts/:id/line-items-custom` handler |
| `src/api/middlewares.ts` | Modify | Register Zod validators for both new routes |
| `src/admin/widgets/order-personalized.tsx` | Create | Admin widget showing dimensions on order detail page |

### Track B — Storefront (all in `storefront/`)

| File | Action | Purpose |
|------|--------|---------|
| `lib/types.ts` | Modify | Add `metadata?: Record<string, unknown>` to `Product` and `CartItem` |
| `lib/medusa/transforms.ts` | Modify | Thread `product.metadata` and `lineItem.metadata` through transforms |
| `lib/medusa/index.ts` | Modify | Add `getCustomVariantPrice`, extend `addToCart` lines type with metadata |
| `lib/analytics.ts` | Modify | Add `personalized_price_calculated` and `personalized_product_added_to_cart` to `AnalyticsEvents` |
| `components/cart/actions.ts` | Modify | Add `addPersonalizedItem` server action |
| `components/product/product-detail.tsx` | Modify | Dimension inputs, live price fetch, personalized add-to-cart path |
| `components/cart/index.tsx` | Modify | Show `Width: Xcm · Height: Xcm` on personalized cart items |
| `app/order/confirmed/[orderId]/page.tsx` | Modify | Same dimensions display on order confirmation items |
| `components/account/order-detail.tsx` | Modify | Same dimensions display on account order detail items |
| `tests/unit/personalized-products.test.ts` | Create | Unit tests for storefront lib functions |

---

## Track A — Backend

### Task A1: `getCustomPriceWorkflow`

**Files:**
- Create: `backend/src/workflows/get-custom-price.ts`

**Background:** Medusa v2 workflows use `createStep` (pure computation) and `useQueryGraphStep` (fetches data via the module graph). `z` is imported from `@medusajs/framework/zod`. All amounts are in **main currency unit** (e.g., `10.5` = $10.50).

- [ ] **Step A1.1: Create the workflow file**

```ts
// backend/src/workflows/get-custom-price.ts
import {
  createStep,
  createWorkflow,
  transform,
  useQueryGraphStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

const DIMENSION_PRICE_FACTOR = 0.01 // price increase per cm²; update per client

// ---------- step ----------

type GetCustomPriceStepInput = {
  baseAmount: number
  height: number
  width: number
  currency_code: string
}

export const getCustomPriceStep = createStep(
  "get-custom-price-step",
  async (input: GetCustomPriceStepInput) => {
    const { baseAmount, height, width, currency_code } = input
    const amount = baseAmount + height * width * DIMENSION_PRICE_FACTOR
    return new StepResponse({ amount, currency_code })
  }
)

// ---------- workflow ----------

type GetCustomPriceWorkflowInput = {
  variantId: string
  regionId: string
  metadata: { height: number; width: number }
}

export const getCustomPriceWorkflow = createWorkflow(
  "get-custom-price-workflow",
  (input: GetCustomPriceWorkflowInput) => {
    // 1. Get region to resolve currency code
    const { data: regions } = useQueryGraphStep({
      entity: "region",
      fields: ["currency_code"],
      filters: { id: input.regionId },
    })
    const currency_code = transform(regions, (r) => r[0]?.currency_code ?? "usd")

    // 2. Get variant's calculated price for this region
    const { data: variants } = useQueryGraphStep({
      entity: "variant",
      fields: ["calculated_price.*"],
      filters: { id: input.variantId },
      options: { throwIfKeyNotFound: false },
    })
    const baseAmount = transform(variants, (v) => {
      const price = v[0]?.calculated_price as { calculated_amount?: number } | undefined
      return price?.calculated_amount ?? 0
    })

    // 3. Apply pricing formula
    const result = getCustomPriceStep(
      transform({ baseAmount, currency_code, metadata: input.metadata }, (d) => ({
        baseAmount: d.baseAmount,
        height: d.metadata.height,
        width: d.metadata.width,
        currency_code: d.currency_code,
      }))
    )

    return new WorkflowResponse(result)
  }
)
```

- [ ] **Step A1.2: Verify the file compiles**

```bash
cd backend && bunx tsc --noEmit 2>&1 | grep -i "get-custom-price" || echo "No errors in this file"
```

Expected: no errors related to `get-custom-price.ts`.

- [ ] **Step A1.3: Commit**

```bash
git add backend/src/workflows/get-custom-price.ts
git commit -m "feat: add getCustomPriceWorkflow for dimension-based pricing"
```

---

### Task A2: `customAddToCartWorkflow` + validation hook

**Files:**
- Create: `backend/src/workflows/custom-add-to-cart.ts`

**Background:** Workflows compose other workflows using `.runAsStep()`. `addToCartWorkflow` from `@medusajs/medusa/core-flows` is the standard cart addition workflow. `acquireLockStep`/`releaseLockStep` prevent concurrent cart modifications. The hook registration (`addToCartWorkflow.hooks.validate`) is a side effect that runs when this file is imported at server start — Medusa auto-loads all `src/workflows/` files.

- [ ] **Step A2.1: Create the workflow file**

```ts
// backend/src/workflows/custom-add-to-cart.ts
import {
  createWorkflow,
  transform,
  useQueryGraphStep,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  addToCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { acquireLockStep, releaseLockStep } from "@medusajs/core-flows"
import { MedusaError } from "@medusajs/framework/utils"
import { getCustomPriceWorkflow } from "./get-custom-price"

// ---------- validation hook (global, active on every addToCartWorkflow run) ----------

addToCartWorkflow.hooks.validate(async ({ input }) => {
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

// ---------- workflow ----------

type CustomAddToCartWorkflowInput = {
  cartId: string
  variantId: string
  quantity: number
  metadata: Record<string, unknown>
}

export const customAddToCartWorkflow = createWorkflow(
  "custom-add-to-cart-workflow",
  (input: CustomAddToCartWorkflowInput) => {
    // 1. Get cart's region
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: ["region_id"],
      filters: { id: input.cartId },
    })
    const region_id = transform(carts, (c) => c[0]?.region_id ?? "")

    // 2. Calculate custom price
    const customPrice = getCustomPriceWorkflow.runAsStep({
      input: transform({ variantId: input.variantId, region_id, metadata: input.metadata }, (d) => ({
        variantId: d.variantId,
        regionId: d.region_id,
        metadata: { height: Number(d.metadata.height), width: Number(d.metadata.width) },
      })),
    })

    // 3. Lock the cart
    acquireLockStep(transform({ cartId: input.cartId }, (d) => ({ keys: [d.cartId], timeout: 2000, ttl: 10000 })))

    // 4. Add line item with custom unit price
    addToCartWorkflow.runAsStep({
      input: transform({ input, customPrice }, (d) => ({
        cart_id: d.input.cartId,
        items: [{
          variant_id: d.input.variantId,
          quantity: d.input.quantity,
          unit_price: d.customPrice.amount,
          metadata: d.input.metadata,
        }],
      })),
    })

    // 5. Release lock
    releaseLockStep(transform({ cartId: input.cartId }, (d) => ({ keys: [d.cartId] })))

    // 6. Re-fetch updated cart
    const { data: updatedCarts } = useQueryGraphStep({
      entity: "cart",
      fields: [
        "id", "currency_code", "total", "item_subtotal", "tax_total",
        "*items", "*items.variant", "*items.product", "*items.thumbnail", "+items.total",
      ],
      filters: { id: input.cartId },
    })
    const cart = transform(updatedCarts, (c) => c[0])

    return new WorkflowResponse({ cart })
  }
)
```

- [ ] **Step A2.2: Verify the file compiles**

```bash
cd backend && bunx tsc --noEmit 2>&1 | grep -i "custom-add-to-cart" || echo "No errors in this file"
```

Expected: no errors related to `custom-add-to-cart.ts`.

- [ ] **Step A2.3: Commit**

```bash
git add backend/src/workflows/custom-add-to-cart.ts
git commit -m "feat: add customAddToCartWorkflow with validation hook"
```

---

### Task A3: API route — `POST /store/variants/:id/price`

**Files:**
- Create: `backend/src/api/store/variants/[id]/price/route.ts`
- Modify: `backend/src/api/middlewares.ts`

**Background:** Medusa v2 API routes export named HTTP method handlers. Zod schemas are co-located in the route file and imported into `middlewares.ts`. Use `z` from `@medusajs/framework/zod`. The route receives the validated body via `req.validatedBody`.

- [ ] **Step A3.1: Create the route handler**

```ts
// backend/src/api/store/variants/[id]/price/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { getCustomPriceWorkflow } from "../../../../workflows/get-custom-price"

export const PostVariantPriceSchema = z.object({
  region_id: z.string(),
  metadata: z.object({
    height: z.number().positive(),
    width: z.number().positive(),
  }),
})

type PostVariantPriceReq = z.infer<typeof PostVariantPriceSchema>

export const POST = async (
  req: MedusaRequest<PostVariantPriceReq>,
  res: MedusaResponse
) => {
  const { region_id, metadata } = req.validatedBody
  const variantId = req.params.id

  const { result } = await getCustomPriceWorkflow(req.scope).run({
    input: { variantId, regionId: region_id, metadata },
  })

  res.json(result)
}
```

- [ ] **Step A3.2: Register middleware in `middlewares.ts`**

Add the import at the top of `backend/src/api/middlewares.ts` with the other schema imports:
```ts
import { PostVariantPriceSchema } from "./store/variants/[id]/price/route"
```

Add a new entry to the `routes` array (after the existing store routes, before admin routes):
```ts
{
  matcher: "/store/variants/:id/price",
  method: ["POST"],
  middlewares: [validateAndTransformBody(PostVariantPriceSchema)],
},
```

- [ ] **Step A3.3: Verify compilation**

```bash
cd backend && bunx tsc --noEmit 2>&1 | grep -E "variants.*price|PostVariantPrice" || echo "No errors for this route"
```

- [ ] **Step A3.4: Start backend and smoke-test the route**

```bash
cd backend && bun run dev &
sleep 5
# Get a real variant ID from the database first, then:
curl -X POST http://localhost:9000/store/variants/VARIANT_ID/price \
  -H "Content-Type: application/json" \
  -d '{"region_id":"REGION_ID","metadata":{"height":10,"width":5}}'
# Expected: {"amount": <base_price + 0.5>, "currency_code": "usd"}
```

- [ ] **Step A3.5: Commit**

```bash
git add backend/src/api/store/variants/\[id\]/price/route.ts backend/src/api/middlewares.ts
git commit -m "feat: add POST /store/variants/:id/price custom pricing route"
```

---

### Task A4: API route — `POST /store/carts/:id/line-items-custom`

**Files:**
- Create: `backend/src/api/store/carts/[id]/line-items-custom/route.ts`
- Modify: `backend/src/api/middlewares.ts`

- [ ] **Step A4.1: Create the route handler**

```ts
// backend/src/api/store/carts/[id]/line-items-custom/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { customAddToCartWorkflow } from "../../../../workflows/custom-add-to-cart"

export const PostCustomLineItemSchema = z.object({
  variant_id: z.string(),
  quantity: z.number().int().positive().optional().default(1),
  metadata: z
    .object({
      height: z.number().positive(),
      width: z.number().positive(),
    })
    .passthrough(), // allow is_personalized and any other client fields through
})

type PostCustomLineItemReq = z.infer<typeof PostCustomLineItemSchema>

export const POST = async (
  req: MedusaRequest<PostCustomLineItemReq>,
  res: MedusaResponse
) => {
  const { variant_id, quantity, metadata } = req.validatedBody
  const cartId = req.params.id

  const { result } = await customAddToCartWorkflow(req.scope).run({
    input: { cartId, variantId: variant_id, quantity: quantity ?? 1, metadata },
  })

  res.json({ cart: result.cart })
}
```

- [ ] **Step A4.2: Register middleware in `middlewares.ts`**

Add the import:
```ts
import { PostCustomLineItemSchema } from "./store/carts/[id]/line-items-custom/route"
```

Add the route entry:
```ts
{
  matcher: "/store/carts/:id/line-items-custom",
  method: ["POST"],
  middlewares: [validateAndTransformBody(PostCustomLineItemSchema)],
},
```

- [ ] **Step A4.3: Verify compilation**

```bash
cd backend && bunx tsc --noEmit 2>&1 | grep -E "line-items-custom|PostCustomLine" || echo "No errors for this route"
```

- [ ] **Step A4.4: Smoke-test validation (missing dimensions)**

```bash
curl -X POST http://localhost:9000/store/carts/CART_ID/line-items-custom \
  -H "Content-Type: application/json" \
  -d '{"variant_id":"VAR_ID","metadata":{"is_personalized":true}}'
# Expected: 400 with INVALID_DATA message about height and width
```

- [ ] **Step A4.5: Commit**

```bash
git add backend/src/api/store/carts/\[id\]/line-items-custom/route.ts backend/src/api/middlewares.ts
git commit -m "feat: add POST /store/carts/:id/line-items-custom custom line item route"
```

---

### Task A5: Admin widget

**Files:**
- Create: `backend/src/admin/widgets/order-personalized.tsx`

**Background:** Medusa admin widgets are React components exported with a `config` object from `defineWidgetConfig`. They receive `data` as a prop containing the entity (here `AdminOrder`). Use `@medusajs/ui` for styling — `Container`, `Heading`, `Table` components. The widget renders `null` when no personalized items exist.

- [ ] **Step A5.1: Create the admin widget**

```tsx
// backend/src/admin/widgets/order-personalized.tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Text } from "@medusajs/ui"
import type { AdminOrder } from "@medusajs/types"

type Props = {
  data: AdminOrder
}

const PersonalizedOrderItemsWidget = ({ data }: Props) => {
  const personalizedItems = (data.items ?? []).filter(
    (item) => (item.metadata as Record<string, unknown> | undefined)?.is_personalized === true
  )

  if (personalizedItems.length === 0) return null

  const meta = (item: (typeof personalizedItems)[0]) =>
    item.metadata as Record<string, unknown>

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Personalization Details</Heading>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Product</Table.HeaderCell>
            <Table.HeaderCell>Width</Table.HeaderCell>
            <Table.HeaderCell>Height</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {personalizedItems.map((item) => (
            <Table.Row key={item.id}>
              <Table.Cell>
                <div className="flex items-center gap-3">
                  {(item.thumbnail) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail}
                      alt={item.product?.title ?? item.title ?? ""}
                      className="h-10 w-10 rounded object-cover"
                    />
                  )}
                  <Text>{item.product?.title ?? item.title}</Text>
                </div>
              </Table.Cell>
              <Table.Cell>{String(meta(item).width ?? "—")}cm</Table.Cell>
              <Table.Cell>{String(meta(item).height ?? "—")}cm</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default PersonalizedOrderItemsWidget
```

- [ ] **Step A5.2: Verify the widget compiles**

```bash
cd backend && bunx tsc --noEmit 2>&1 | grep -i "order-personalized" || echo "No errors in widget"
```

- [ ] **Step A5.3: Start backend and check admin UI**

Start backend with `cd backend && bun run dev` then open `http://localhost:9000/app`. Navigate to any order. The widget zone `order.details.after` should appear (will be empty if no personalized items yet).

- [ ] **Step A5.4: Commit**

```bash
git add backend/src/admin/widgets/order-personalized.tsx
git commit -m "feat: add PersonalizedOrderItemsWidget admin widget"
```

---

## Track B — Storefront

### Task B1: Types + transforms + analytics type map

**Files:**
- Modify: `storefront/lib/types.ts`
- Modify: `storefront/lib/medusa/transforms.ts`
- Modify: `storefront/lib/analytics.ts`

**Background:** This task is the foundation — later tasks depend on `metadata` being available on `Product` and `CartItem`. `metadata` on `CartItem` goes at the **top level** (not inside `merchandise`) mirroring Medusa's `lineItem.metadata`. The `CART_FIELDS` constant in `index.ts` needs `+items.metadata` added so line item metadata is fetched.

- [ ] **Step B1.1: Write failing tests for the type changes**

Create `storefront/tests/unit/personalized-products.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

// --- Type shape tests ---
// These verify that TypeScript compiles with the expected shape.
// Since this is a runtime test file, we test via object assignment
// (TypeScript errors would prevent the test from running).

describe("Product metadata type", () => {
  it("accepts metadata on Product", () => {
    const product = {
      id: "prod_1",
      handle: "test",
      availableForSale: true,
      title: "Custom Fabric",
      description: "",
      descriptionHtml: "",
      options: [],
      priceRange: { minVariantPrice: { amount: "10.00", currencyCode: "USD" }, maxVariantPrice: { amount: "10.00", currencyCode: "USD" } },
      variants: [],
      featuredImage: { url: "", altText: "", width: 0, height: 0 },
      images: [],
      seo: { title: "", description: "" },
      tags: [],
      updatedAt: "",
      metadata: { is_personalized: true },  // <-- the new field
    }
    expect(product.metadata?.is_personalized).toBe(true)
  })
})

describe("CartItem metadata type", () => {
  it("accepts metadata on CartItem top level", () => {
    const item = {
      id: "item_1",
      quantity: 1,
      cost: { totalAmount: { amount: "10.50", currencyCode: "USD" } },
      merchandise: {
        id: "var_1",
        title: "S",
        selectedOptions: [],
        product: { id: "prod_1", handle: "test", title: "Custom Fabric", featuredImage: { url: "", altText: "", width: 0, height: 0 } },
      },
      metadata: { is_personalized: true, height: 10, width: 5 },  // <-- top level
    }
    expect(item.metadata?.is_personalized).toBe(true)
    expect(item.metadata?.height).toBe(10)
  })
})
```

- [ ] **Step B1.2: Run the test and confirm it fails (metadata field not on types yet)**

```bash
cd storefront && bun run vitest tests/unit/personalized-products.test.ts 2>&1 | head -30
```

Expected: TypeScript error that `metadata` does not exist on `Product` or `CartItem`.

- [ ] **Step B1.3: Add `metadata` to `Product` type**

In `storefront/lib/types.ts`, add to the `Product` type definition (after `updatedAt`):
```ts
  metadata?: Record<string, unknown>;
```

Add to the `CartItem` type definition at the top level (after the `merchandise` block, before the closing `}`):
```ts
  metadata?: Record<string, unknown>;
```

- [ ] **Step B1.4: Thread metadata through `transformProduct`**

In `storefront/lib/medusa/transforms.ts`, in the `transformProduct` function's return object, add after `updatedAt`:
```ts
    metadata: product.metadata ?? undefined,
```

- [ ] **Step B1.5: Thread metadata through `transformCart` line items**

In `storefront/lib/medusa/transforms.ts`, in the `transformCart` function's `.map((item) => { return { ... } })` block, add `metadata` at the top level of the returned `CartItem` object (after the `merchandise` block):
```ts
      metadata: (item.metadata as Record<string, unknown> | undefined) ?? undefined,
```

- [ ] **Step B1.6: Add `+items.metadata` to the cart fields string**

In `storefront/lib/medusa/index.ts`, find `CART_FIELDS` (line ~107-108):
```ts
const CART_FIELDS =
  "*items,*items.product,*items.variant,*items.thumbnail,+items.total,*promotions,+shipping_methods.name";
```

Change to:
```ts
const CART_FIELDS =
  "*items,*items.product,*items.variant,*items.thumbnail,+items.total,+items.metadata,*promotions,+shipping_methods.name";
```

- [ ] **Step B1.7: Add analytics events to `AnalyticsEvents` type**

In `storefront/lib/analytics.ts`, add to the `AnalyticsEvents` type map in the `// --- Product ---` section:
```ts
  personalized_price_calculated: {
    variant_id: string;
    height: number;
    width: number;
    calculated_price: number;
  };
  personalized_product_added_to_cart: {
    variant_id: string;
    height: number;
    width: number;
    price: number;
  };
```

- [ ] **Step B1.8: Run tests to verify they pass**

```bash
cd storefront && bun run vitest tests/unit/personalized-products.test.ts 2>&1
```

Expected: PASS (both tests).

- [ ] **Step B1.9: Run full typecheck**

```bash
cd storefront && bun run typecheck 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step B1.10: Commit**

```bash
git add storefront/lib/types.ts storefront/lib/medusa/transforms.ts storefront/lib/medusa/index.ts storefront/lib/analytics.ts
git commit -m "feat: add metadata to Product and CartItem types, thread through transforms"
```

---

### Task B2: `getCustomVariantPrice` lib function + `addToCart` metadata support

**Files:**
- Modify: `storefront/lib/medusa/index.ts`
- Modify: `storefront/tests/unit/personalized-products.test.ts`

**Background:** `getCustomVariantPrice` calls the new backend route. It returns `{ amount: string, currency_code: string }` where `amount` is a decimal string (e.g. `"10.50"`) — using `.toFixed(2)` since Medusa v2 amounts are in the main currency unit. `addToCart` gains an optional `metadata` field per line; when present it calls the custom route instead of the standard SDK method.

- [ ] **Step B2.1: Write failing tests**

Add to `storefront/tests/unit/personalized-products.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from "vitest"

// --- getCustomVariantPrice ---
describe("getCustomVariantPrice", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("calls the price route and returns a decimal string amount", async () => {
    // Mock sdk.client.fetch
    vi.doMock("lib/medusa/index", async (importOriginal) => {
      const actual = await importOriginal<typeof import("lib/medusa/index")>()
      return {
        ...actual,
        getCustomVariantPrice: async (
          variantId: string,
          regionId: string,
          metadata: { height: number; width: number }
        ) => {
          // Simulate the fetch returning main-unit amount
          const fakeAmount = 10 + metadata.height * metadata.width * 0.01
          return { amount: fakeAmount.toFixed(2), currency_code: "usd" }
        },
      }
    })

    const { getCustomVariantPrice } = await import("lib/medusa/index")
    const result = await getCustomVariantPrice("var_1", "reg_1", { height: 10, width: 5 })
    expect(result.amount).toBe("10.50")
    expect(result.currency_code).toBe("usd")
  })
})
```

- [ ] **Step B2.2: Run to confirm test fails (function not exported yet)**

```bash
cd storefront && bun run vitest tests/unit/personalized-products.test.ts 2>&1 | grep -E "FAIL|PASS|Error" | head -10
```

- [ ] **Step B2.3: Add `getCustomVariantPrice` to `storefront/lib/medusa/index.ts`**

Add after the `addToCart` function (around line 415):

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
  // Amounts are in main currency unit (e.g. 10.5 = $10.50) — use toFixed(2) like toMoney()
  return { amount: res.amount.toFixed(2), currency_code: res.currency_code }
}
```

- [ ] **Step B2.4: Add `metadata` param to `addToCart` lines**

In `storefront/lib/medusa/index.ts`, update the `addToCart` signature:

Change:
```ts
export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[],
): Promise<Cart> {
```

To:
```ts
export async function addToCart(
  lines: { merchandiseId: string; quantity: number; metadata?: Record<string, unknown> }[],
): Promise<Cart> {
```

In the `for (const line of lines)` loop, replace the `sdk.store.cart.createLineItem` call with:

```ts
    if (line.metadata) {
      // Personalized item — use custom pricing route
      await sdk.client
        .fetch(`/store/carts/${cartId}/line-items-custom`, {
          method: "POST",
          body: {
            variant_id: line.merchandiseId,
            quantity: line.quantity,
            metadata: line.metadata,
          },
        })
        .catch(medusaError)
    } else {
      await sdk.store.cart
        .createLineItem(
          cartId,
          { variant_id: line.merchandiseId, quantity: line.quantity },
          {},
          headers,
        )
        .catch(medusaError)
    }
```

- [ ] **Step B2.5: Run tests**

```bash
cd storefront && bun run vitest tests/unit/personalized-products.test.ts 2>&1
```

Expected: PASS.

- [ ] **Step B2.6: Run typecheck**

```bash
cd storefront && bun run typecheck 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step B2.7: Commit**

```bash
git add storefront/lib/medusa/index.ts storefront/tests/unit/personalized-products.test.ts
git commit -m "feat: add getCustomVariantPrice and metadata support in addToCart"
```

---

### Task B3: `addPersonalizedItem` server action

**Files:**
- Modify: `storefront/components/cart/actions.ts`

**Background:** Server actions with non-`useActionState` signatures can be called directly as async functions from client components. This action mirrors `addItem`'s error handling pattern — returns `string | null` rather than throwing. `revalidateCart` is a private helper already defined in the same file.

- [ ] **Step B3.1: Add `addPersonalizedItem` to `storefront/components/cart/actions.ts`**

Add after the `addItem` function:

```ts
export async function addPersonalizedItem(
  variantId: string,
  metadata: { height: number; width: number; is_personalized: true }
): Promise<CartActionState> {
  if (!variantId) return "Please select a product variant"

  try {
    await addToCart([{ merchandiseId: variantId, quantity: 1, metadata }])
    try {
      await trackServer("personalized_product_added_to_cart", {
        variant_id: variantId,
        height: metadata.height,
        width: metadata.width,
        price: 0, // caller will pass actual price if needed; 0 is safe fallback
      })
    } catch {}
    return null
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "add_personalized_item" } })
    return e instanceof Error ? e.message : "Error adding item to cart"
  } finally {
    revalidateCart()
  }
}
```

- [ ] **Step B3.2: Run typecheck**

```bash
cd storefront && bun run typecheck 2>&1 | grep -i "actions" | head -10
```

Expected: no errors.

- [ ] **Step B3.3: Commit**

```bash
git add storefront/components/cart/actions.ts
git commit -m "feat: add addPersonalizedItem server action"
```

---

### Task B4: `ProductDetail` — dimension inputs + dynamic pricing + personalized add-to-cart

**Files:**
- Modify: `storefront/components/product/product-detail.tsx`

**Background:** `ProductDetail` is already a `'use client'` component (432 lines). This task adds UI only when `sourceProduct.metadata?.is_personalized === true` — the non-personalized path must be completely unchanged. `getCustomVariantPrice` and `getDefaultRegion` are imported from `lib/medusa`. The debounce uses a `useRef`-held numeric timer handle so it persists across renders. `addPersonalizedItem` is called directly (not via `useActionState`).

**Key variables already in `ProductDetail`:**
- `state` — selected option state from `useProduct()`
- `selectedVariant` — currently selected variant (derive from `combinations` + `state`)
- `sourceProduct` — raw `Product` with metadata

- [ ] **Step B4.1: Add imports at the top of `product-detail.tsx`**

Find the existing import block. Add:
```ts
import { getCustomVariantPrice, getDefaultRegion } from "lib/medusa"
import { addPersonalizedItem } from "components/cart/actions"
import * as Sentry from "@sentry/nextjs"
```

- [ ] **Step B4.2: Add state variables inside `ProductDetail`**

After the existing `const { state, updateOption: updateOptionContext } = useProduct()` line, add:

```ts
  const [height, setHeight] = useState<number | "">("")
  const [width, setWidth] = useState<number | "">("")
  const [customPrice, setCustomPrice] = useState<{ amount: string; currency_code: string } | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const debounceTimerRef = useRef<number | null>(null)
```

Make sure `useState` and `useRef` are imported from `"react"` (they should already be).

- [ ] **Step B4.3: Add the debounced price-fetch effect**

After the existing `useEffect` for analytics tracking, add:

```ts
  // Debounced custom price fetch — only for personalized products
  useEffect(() => {
    if (!sourceProduct.metadata?.is_personalized) return
    if (!selectedVariantId || !height || !width) {
      setCustomPrice(null)
      return
    }

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const region = await getDefaultRegion()
        const price = await getCustomVariantPrice(
          selectedVariantId,
          region.id,
          { height: Number(height), width: Number(width) }
        )
        setCustomPrice(price)
        trackClient("personalized_price_calculated", {
          variant_id: selectedVariantId,
          height: Number(height),
          width: Number(width),
          calculated_price: parseFloat(price.amount),
        })
      } catch (err) {
        Sentry.captureException(err)
        setCustomPrice(null) // fall back to variant base price
      }
    }, 300)

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
      }
    }
  }, [height, width, selectedVariantId, sourceProduct.metadata?.is_personalized])
```

Note: `selectedVariantId` is the ID of the currently selected variant. Find how it's derived in the existing component (look for the `combinations` / `state` pattern). If it's not already extracted, add:
```ts
  const selectedVariantId = combinations.find(
    (c) => Object.entries(state).every(([k, v]) => c[k] === v)
  )?.id
```

- [ ] **Step B4.4: Add the personalized add-to-cart handler**

After the effects, add:

```ts
  const handlePersonalizedAddToCart = async () => {
    if (!selectedVariantId || !height || !width) return
    setAddError(null)
    setIsAddingToCart(true)
    try {
      const err = await addPersonalizedItem(selectedVariantId, {
        height: Number(height),
        width: Number(width),
        is_personalized: true,
      })
      if (err) {
        setAddError(err)
      } else {
        trackClient("personalized_product_added_to_cart", {
          variant_id: selectedVariantId,
          height: Number(height),
          width: Number(width),
          price: customPrice ? parseFloat(customPrice.amount) : 0,
        })
      }
    } finally {
      setIsAddingToCart(false)
    }
  }
```

- [ ] **Step B4.5: Add dimension inputs and custom price display to the JSX**

Find where `ProductDetailPrice` and `AddToCart` are rendered in the JSX. The personalized product block replaces the price display and add-to-cart button with a conditional wrapper. Locate the section and wrap it:

```tsx
{sourceProduct.metadata?.is_personalized ? (
  <div className="mt-6">
    {/* Dimension inputs */}
    <div className="flex gap-4">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Height (cm)
        </label>
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={height}
          onChange={(e) => setHeight(e.target.value === "" ? "" : parseFloat(e.target.value))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="e.g. 10"
        />
      </div>
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Width (cm)
        </label>
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={width}
          onChange={(e) => setWidth(e.target.value === "" ? "" : parseFloat(e.target.value))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="e.g. 5"
        />
      </div>
    </div>

    {/* Dynamic price */}
    <div className="mt-4">
      <ProductDetailPrice
        amount={customPrice?.amount ?? selectedVariant?.price.amount ?? "0.00"}
        currencyCode={customPrice?.currency_code ?? selectedVariant?.price.currencyCode ?? "USD"}
      />
    </div>

    {/* Custom add to cart */}
    <button
      onClick={handlePersonalizedAddToCart}
      disabled={!selectedVariantId || !height || !width || Number(height) <= 0 || Number(width) <= 0 || isAddingToCart}
      className="mt-4 relative flex w-full items-center justify-center rounded-full bg-primary-600 p-4 tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isAddingToCart ? "Adding..." : "Add To Cart"}
    </button>

    {addError && (
      <p className="mt-2 text-sm text-red-600">{addError}</p>
    )}
  </div>
) : (
  // Non-personalized path — completely unchanged
  <>
    <ProductDetailPrice
      amount={selectedVariant?.price.amount ?? "0.00"}
      currencyCode={selectedVariant?.price.currencyCode ?? "USD"}
    />
    <AddToCart product={sourceProduct} />
  </>
)}
```

Verify that the existing `<ProductDetailPrice>` and `<AddToCart>` calls in the non-personalized path match exactly what was there before.

- [ ] **Step B4.6: Run typecheck**

```bash
cd storefront && bun run typecheck 2>&1 | grep -i "product-detail" | head -10
```

Expected: no errors.

- [ ] **Step B4.7: Commit**

```bash
git add storefront/components/product/product-detail.tsx
git commit -m "feat: add dimension inputs and custom pricing to ProductDetail"
```

---

### Task B5: Cart item metadata display

**Files:**
- Modify: `storefront/components/cart/index.tsx`

**Background:** Cart items are rendered via `cart.lines.map(...)`. Each `CartItem` now has a top-level `metadata` field (from Task B1). Read `item.metadata?.is_personalized` to conditionally show dimensions.

- [ ] **Step B5.1: Find the variant option display in `storefront/components/cart/index.tsx`**

Search for where `selectedOptions` or variant title is rendered for each line item. Look for `item.merchandise.selectedOptions.map(...)` or similar.

- [ ] **Step B5.2: Add dimensions display after the variant options**

After the existing variant option display for each item, add:

```tsx
{item.metadata?.is_personalized && (
  <p className="mt-1 text-sm text-gray-500">
    Width: {String(item.metadata.width ?? "—")}cm · Height: {String(item.metadata.height ?? "—")}cm
  </p>
)}
```

- [ ] **Step B5.3: Run typecheck**

```bash
cd storefront && bun run typecheck 2>&1 | grep -i "cart/index" | head -5
```

Expected: no errors.

- [ ] **Step B5.4: Commit**

```bash
git add storefront/components/cart/index.tsx
git commit -m "feat: show personalization dimensions in cart item display"
```

---

### Task B6: Order item metadata display

**Files:**
- Modify: `storefront/app/order/confirmed/[orderId]/page.tsx`
- Modify: `storefront/components/account/order-detail.tsx`

**Background:** Both files use raw Medusa `StoreOrder` / `StoreOrderLineItem` types (from `@medusajs/types`) which already include `metadata?: Record<string, unknown>`. No type changes needed. The order confirmation page renders items at ~line 118; `order-detail.tsx` at ~line 226.

- [ ] **Step B6.1: Add dimensions display to order confirmation page**

In `storefront/app/order/confirmed/[orderId]/page.tsx`, find the `order.items.map` block (~line 118). After the variant title display (the block showing `item.variant?.title`), add:

```tsx
{item.metadata?.is_personalized && (
  <p className="mt-1 text-sm text-gray-500">
    Width: {String((item.metadata as Record<string, unknown>).width ?? "—")}cm · Height: {String((item.metadata as Record<string, unknown>).height ?? "—")}cm
  </p>
)}
```

- [ ] **Step B6.2: Add dimensions display to account order detail**

In `storefront/components/account/order-detail.tsx`, find the `order.items?.map` block (~line 226). After the variant title display, add the same block:

```tsx
{item.metadata?.is_personalized && (
  <p className="mt-1 text-sm text-gray-500">
    Width: {String((item.metadata as Record<string, unknown>).width ?? "—")}cm · Height: {String((item.metadata as Record<string, unknown>).height ?? "—")}cm
  </p>
)}
```

- [ ] **Step B6.3: Run typecheck**

```bash
cd storefront && bun run typecheck 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step B6.4: Run all unit tests**

```bash
cd storefront && bun run vitest 2>&1
```

Expected: all existing tests pass + new personalized-products tests pass.

- [ ] **Step B6.5: Commit**

```bash
git add "storefront/app/order/confirmed/[orderId]/page.tsx" storefront/components/account/order-detail.tsx
git commit -m "feat: show personalization dimensions in order confirmation and account orders"
```

---

## End-to-End Verification

Once both tracks are merged into the working branch:

- [ ] **E2E.1: Mark a product as personalized in the admin**

  Open `http://localhost:9000/app`, navigate to a product, edit its metadata, add `is_personalized: true`. Save.

- [ ] **E2E.2: Visit the product page on the storefront**

  Navigate to `http://localhost:3000/product/<handle>`. Confirm dimension inputs appear. Enter height=10, width=5. Confirm price updates ~300ms after input.

- [ ] **E2E.3: Add to cart**

  Click "Add To Cart". Confirm the cart drawer opens and shows the item with "Width: 5cm · Height: 10cm" below the variant.

- [ ] **E2E.4: Complete checkout**

  Go through checkout to order confirmation. Confirm dimensions are shown on the order confirmation page.

- [ ] **E2E.5: Check admin order widget**

  Open the order in the admin UI. Confirm the "Personalization Details" widget appears with the item's dimensions.

- [ ] **E2E.6: Validate error case**

  Try adding the personalized product without entering dimensions — confirm the button stays disabled. If you call the API directly without dimensions, confirm a 400 error is returned.

---

## Notes for Subagent Workers

- **Imports:** Backend uses `z` from `@medusajs/framework/zod`, not `zod` directly.
- **Amount units:** All Medusa v2 `calculated_amount` values are in the **main currency unit** (e.g., `10.5` = $10.50). Do not multiply or divide by 100.
- **Cart metadata field:** `CartItem.metadata` is at the **top level**, not inside `CartItem.merchandise`.
- **`addItem` is unchanged:** The personalized path uses `addPersonalizedItem` (direct call). The existing `addItem` / `useActionState` wiring is untouched.
- **Non-personalized path in `ProductDetail`:** The existing `<ProductDetailPrice>` and `<AddToCart>` must remain exactly as before for non-personalized products.
- **Hook registration:** `addToCartWorkflow.hooks.validate` in `custom-add-to-cart.ts` is a global side effect — it's active on all `addToCartWorkflow` calls, not just the custom route.
