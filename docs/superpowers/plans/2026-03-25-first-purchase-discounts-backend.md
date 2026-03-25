# First-Purchase Discounts — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-apply a `FIRST_PURCHASE` promotion to any cart created by a registered customer with zero prior orders, and block ineligible use via validation hooks.

**Architecture:** A Medusa workflow queries cart + customer + order history, checks eligibility, and applies the promotion via `updateCartPromotionsStep`. Two subscribers fire the workflow on `cart.created` and the customer-transfer cart event. Validation hooks on `updateCartPromotionsWorkflow` and `completeCartWorkflow` enforce eligibility for manual applications. The hooks file is loaded via a side-effect import in the subscriber so Medusa discovers it at startup.

**Tech Stack:** Medusa v2, `@medusajs/framework/workflows-sdk` (`createWorkflow`, `createStep`, `transform`, `when`), `@medusajs/medusa/core-flows` (`useQueryGraphStep`, `updateCartPromotionsStep`), `@medusajs/framework/types` (`SubscriberArgs`, `SubscriberConfig`), TypeScript

**Reference:** https://docs.medusajs.com/resources/how-to-tutorials/tutorials/first-purchase-discounts — read the full tutorial before implementing. The plan below follows it closely. Use it to verify exact step signatures and `when` usage.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/src/constants.ts` | Shared constant for promotion code string |
| Create | `backend/src/workflows/apply-first-purchase-promo.ts` | Workflow: check eligibility + apply promotion |
| Create | `backend/src/subscribers/apply-first-purchase.ts` | Fire workflow on cart.created / cart.customer_transferred |
| Create | `backend/src/workflows/hooks/validate-promotion.ts` | Block ineligible manual use at update + checkout |

---

## Task 1: Constants file

**Files:**
- Create: `backend/src/constants.ts`

- [ ] **Step 1: Create the constants file**

```ts
// backend/src/constants.ts
export const FIRST_PURCHASE_PROMOTION_CODE = "FIRST_PURCHASE"
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/constants.ts
git commit -m "feat: add FIRST_PURCHASE_PROMOTION_CODE constant"
```

---

## Task 2: Apply-first-purchase-promo workflow

**Files:**
- Create: `backend/src/workflows/apply-first-purchase-promo.ts`

Before writing: read the tutorial at https://docs.medusajs.com/resources/how-to-tutorials/tutorials/first-purchase-discounts to verify exact `useQueryGraphStep` field names, `updateCartPromotionsStep` input shape, and `when` usage. The code below is a faithful starting point; trust the tutorial over this plan if signatures differ.

- [ ] **Step 1: Create the workflow file**

```ts
// backend/src/workflows/apply-first-purchase-promo.ts
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  useQueryGraphStep,
  updateCartPromotionsStep,
} from "@medusajs/medusa/core-flows"
import { FIRST_PURCHASE_PROMOTION_CODE } from "../constants"

type Input = { cart_id: string }

/**
 * Pure eligibility check — runs after data is fetched, returns whether
 * the promotion should be applied and the cart_id to apply it to.
 */
const checkFirstPurchaseEligibilityStep = createStep(
  "check-first-purchase-eligibility",
  async (input: {
    cart: {
      id: string
      promotions?: { code: string }[]
      customer?: { id: string; orders?: { id: string }[] }
    } | undefined
    promotion: { id: string; code: string } | undefined
  }) => {
    const { cart, promotion } = input

    if (!cart || !promotion) {
      return new StepResponse({ eligible: false, cart_id: null as string | null })
    }
    if (!cart.customer?.id) {
      return new StepResponse({ eligible: false, cart_id: null as string | null })
    }
    if ((cart.customer.orders ?? []).length > 0) {
      return new StepResponse({ eligible: false, cart_id: null as string | null })
    }
    const alreadyApplied = (cart.promotions ?? []).some(
      (p) => p.code === FIRST_PURCHASE_PROMOTION_CODE
    )
    if (alreadyApplied) {
      return new StepResponse({ eligible: false, cart_id: null as string | null })
    }

    return new StepResponse({ eligible: true, cart_id: cart.id })
  }
)

export const applyFirstPurchasePromoWorkflow = createWorkflow(
  "apply-first-purchase-promo",
  (input: Input) => {
    // Fetch cart with its applied promotions, customer, and customer's order history
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: [
        "id",
        "promotions.code",
        "customer.id",
        "customer.orders.id",
      ],
      filters: { id: input.cart_id },
    })

    // Fetch the first-purchase promotion by code
    const { data: promotions } = useQueryGraphStep({
      entity: "promotion",
      fields: ["id", "code"],
      filters: { code: FIRST_PURCHASE_PROMOTION_CODE },
    }).config({ name: "get-first-purchase-promotion" })

    // Determine eligibility
    const eligibility = checkFirstPurchaseEligibilityStep(
      transform({ carts, promotions }, ({ carts, promotions }) => ({
        cart: carts[0] as {
          id: string
          promotions?: { code: string }[]
          customer?: { id: string; orders?: { id: string }[] }
        } | undefined,
        promotion: promotions[0] as { id: string; code: string } | undefined,
      }))
    )

    // Only apply when eligible — use (data) => data.eligibility.eligible pattern,
    // NOT destructuring, to match how `when` is used elsewhere in this codebase
    when({ eligibility }, (data) => data.eligibility.eligible).then(
      () => {
        updateCartPromotionsStep({
          id: eligibility.cart_id!,
          promo_codes: { add: [FIRST_PURCHASE_PROMOTION_CODE] },
        })
      }
    )

    return new WorkflowResponse({})
  }
)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && bunx tsc --noEmit
```

Expected: no errors. If `updateCartPromotionsStep` input shape or `when` usage differs from what the tutorial shows, fix to match the tutorial.

- [ ] **Step 3: Commit**

```bash
git add backend/src/workflows/apply-first-purchase-promo.ts
git commit -m "feat: add apply-first-purchase-promo workflow"
```

---

## Task 3: Subscriber

**Files:**
- Create: `backend/src/subscribers/apply-first-purchase.ts`

- [ ] **Step 1: Create the subscriber**

```ts
// backend/src/subscribers/apply-first-purchase.ts
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import * as Sentry from "@sentry/node"
import { applyFirstPurchasePromoWorkflow } from "../workflows/apply-first-purchase-promo"

export default async function applyFirstPurchaseHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    await applyFirstPurchasePromoWorkflow(container).run({
      input: { cart_id: data.id },
    })
    logger.info(`[first-purchase] Checked cart ${data.id} for first-purchase promo`)
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        subscriber: "apply_first_purchase",
        cart_id: data.id,
      },
    })
    logger.error(
      `[first-purchase] Failed to apply first-purchase promo to cart ${data.id}`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  // "cart.created" fires when any cart is created.
  // The second event fires when a guest cart is transferred to a logged-in customer.
  // Verify the exact event name against the Medusa v2 source or the tutorial —
  // it may be "cart.customer_transferred" or "cart.customer_updated".
  event: ["cart.created", "cart.customer_transferred"],
}

// Load the validation hooks so Medusa registers them at startup.
// This side-effect import is required — Medusa does not auto-scan workflows/hooks/.
import "../workflows/hooks/validate-promotion"
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/subscribers/apply-first-purchase.ts
git commit -m "feat: add apply-first-purchase subscriber"
```

---

## Task 4: Validation hooks

**Files:**
- Create: `backend/src/workflows/hooks/validate-promotion.ts`

These hooks fire when *any* code invokes `updateCartPromotionsWorkflow` or `completeCartWorkflow`. They enforce that `FIRST_PURCHASE` can only be used by eligible customers.

Before writing: verify the hook registration API against the Medusa docs at https://docs.medusajs.com/resources/how-to-tutorials/tutorials/first-purchase-discounts — specifically the `validate-promotion` hook section. The container resolver used in hooks may differ from workflow steps.

- [ ] **Step 1: Create the hooks file**

```ts
// backend/src/workflows/hooks/validate-promotion.ts
import {
  updateCartPromotionsWorkflow,
  completeCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { FIRST_PURCHASE_PROMOTION_CODE } from "../../constants"

async function validateFirstPurchaseEligibility(
  cartId: string,
  container: Parameters<Parameters<typeof updateCartPromotionsWorkflow.hooks.validate>[0]>[1]["container"]
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Note: only query fields confirmed valid for the "cart" entity in Medusa v2.
  // "customer.has_account" is intentionally omitted — the field name is unverified
  // and the customer.id check (guests have no customer record) is sufficient.
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["customer.id", "customer.orders.id"],
    filters: { id: cartId },
  })

  const cart = carts[0]

  // No customer on cart means guest — not eligible
  if (!cart?.customer?.id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "FIRST_PURCHASE promotion is only available to registered customers"
    )
  }

  if ((cart.customer.orders ?? []).length > 0) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "FIRST_PURCHASE promotion is only available for your first order"
    )
  }
}

// Block ineligible manual application of FIRST_PURCHASE
updateCartPromotionsWorkflow.hooks.validate(
  async ({ input }, { container }) => {
    const promoCodes: string[] = (input as any).promo_codes?.add ?? []
    if (!promoCodes.includes(FIRST_PURCHASE_PROMOTION_CODE)) return

    await validateFirstPurchaseEligibility((input as any).id, container)
  }
)

// Block checkout completion if FIRST_PURCHASE is present but customer is not eligible
completeCartWorkflow.hooks.validate(
  async ({ cart_id }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["promotions.code"],
      filters: { id: cart_id },
    })

    const cart = carts[0]
    const hasFirstPurchasePromo = (cart?.promotions ?? []).some(
      (p: { code: string }) => p.code === FIRST_PURCHASE_PROMOTION_CODE
    )

    if (!hasFirstPurchasePromo) return

    await validateFirstPurchaseEligibility(cart_id, container)
  }
)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && bunx tsc --noEmit
```

Expected: no errors. If the hook registration API differs from what the tutorial shows, adjust to match the tutorial exactly.

- [ ] **Step 3: Verify the side-effect import in the subscriber loads the hooks**

Medusa does NOT auto-scan `workflows/hooks/`. The hooks file is loaded via the side-effect import already added to `backend/src/subscribers/apply-first-purchase.ts` in Task 3 (`import "../workflows/hooks/validate-promotion"`). Since Medusa auto-loads all files in `src/subscribers/`, this guarantees the hook consumers are registered at startup.

Confirm that `apply-first-purchase.ts` contains the import at the bottom (it was added in Task 3). No changes needed in `medusa-config.ts`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/workflows/hooks/validate-promotion.ts
git commit -m "feat: add first-purchase promotion validation hooks"
```

---

## Task 5: End-to-end verification

- [ ] **Step 1: Start the backend dev server**

```bash
cd backend && bun run dev
```

Expected: server starts on http://localhost:9000 with no TypeScript or import errors in the console. Watch for `[first-purchase]` log lines.

- [ ] **Step 2: Create the FIRST_PURCHASE promotion in admin**

Navigate to http://localhost:9000/app → Promotions → Create promotion.

Settings:
- Code: `FIRST_PURCHASE`
- Type: Percentage
- Value: 10
- Scope: All products
- Usage limit: none (unlimited)

This is required for the workflow to find a promotion to apply. Without this, the workflow silently skips (safe behaviour).

- [ ] **Step 3: Smoke test**

Using a registered customer account with zero prior orders, add a product to cart. Check the backend logs — you should see `[first-purchase] Checked cart <id>` and the cart should now have the `FIRST_PURCHASE` promotion applied.

Using a registered customer with ≥1 existing order, add a product to cart. The promotion should NOT be applied.

- [ ] **Step 4: Final commit**

```bash
git add -p   # stage any fixes from verification
git commit -m "chore: verify first-purchase backend smoke test"
```
