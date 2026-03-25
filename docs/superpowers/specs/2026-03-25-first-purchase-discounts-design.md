# First-Purchase Discounts — Design Spec

**Date:** 2026-03-25
**Status:** Approved

## Overview

Implement first-purchase discounts across the full stack:

1. **Backend automation** — auto-apply a `FIRST_PURCHASE` promotion to any eligible cart (registered customer, zero previous orders, promotion not already applied) via a Medusa workflow + subscriber + validation hooks
2. **Promo code input UI** — collapsible input in the checkout order summary so users can manually apply or remove promotion codes
3. **Discount popup** — one-time modal for unauthenticated visitors advertising 10% off their first order and linking to account registration

Reference: [Medusa first-purchase discounts tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/first-purchase-discounts)

---

## Execution Strategy

Two parallel subagents in isolated git worktrees:

| Agent | Worktree | Scope |
|-------|----------|-------|
| Agent 1 | backend worktree | Backend automation (workflow, subscriber, hooks, constants) |
| Agent 2 | frontend worktree | Storefront UI (promo code input, discount popup, server actions, analytics, tests) |

Both tracks share zero files and can be reviewed and merged independently.

**Admin setup (one-time manual step):** After the backend is deployed, create a promotion in the Medusa admin with code `FIRST_PURCHASE`, 10% off, no per-customer usage limit. The workflow auto-applies it but does not create it.

---

## Backend — Agent 1

### Files

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/constants.ts` | Create | Export `FIRST_PURCHASE_PROMOTION_CODE = "FIRST_PURCHASE"` |
| `backend/src/workflows/apply-first-purchase-promo.ts` | Create | Workflow: fetch cart → query promotion → conditionally apply |
| `backend/src/subscribers/apply-first-purchase.ts` | Create | Fire workflow on `cart.created` and `cart.customer_transferred` |
| `backend/src/workflows/hooks/validate-promotion.ts` | Create | Hook consumers for `updateCartPromotionsWorkflow` and `completeCartWorkflow` |

### Workflow: `apply-first-purchase-promo`

Steps executed in sequence:
1. `useQueryGraphStep` — fetch cart with `promotions`, `customer`, and customer's orders
2. Query the `FIRST_PURCHASE` promotion by code
3. Guard conditions (skip if any fail):
   - Promotion exists
   - Cart does not already have the promotion
   - Customer has 0 completed orders
4. `updateCartPromotionsStep` — apply the promotion to the cart

### Subscriber: `apply-first-purchase`

- Listens to: `cart.created`, `cart.customer_transferred`
- Executes `applyFirstPurchasePromoWorkflow` with the cart ID

### Validation Hooks: `validate-promotion`

**`updateCartPromotionsWorkflow.validate`**
- If the `FIRST_PURCHASE` code is being applied manually, verify:
  - Customer exists on cart
  - Customer has a registered account
  - Customer has 0 previous orders
- Throw `MedusaError` if any condition fails

**`completeCartWorkflow.validate`**
- Same checks before order completion
- Prevents checkout if the first-purchase promotion is present but the customer is not eligible

### Tests (Backend)

- Workflow guard logic:
  - Customer with 0 orders → promotion applied
  - Customer with ≥1 order → workflow exits early, no promotion applied
  - Cart already has promotion → workflow exits early
- Validation hook:
  - Valid first-time customer → passes
  - Returning customer attempting manual apply → throws `MedusaError`
  - Guest (no customer on cart) attempting manual apply → throws `MedusaError`

---

## Frontend — Agent 2

### Promo Code Input

**New file:** `storefront/components/checkout/promo-code-input.tsx` (client component)

Props: `promotions: HttpTypes.StorePromotion[]`

UI behavior:
- Collapsible section using Headless UI `Disclosure`, placed below the line items list in `order-summary.tsx`
- Inline text input + "Apply" button — TailwindUI Ecommerce > Shopping Carts input pattern
- Applied codes rendered as removable chips above the input (code label + × dismiss button)
- Pending state while server action is in flight (button disabled, spinner)
- Inline error message on invalid/already-applied/expired code

**Modified file:** `storefront/components/checkout/order-summary.tsx`
- Remains a Server Component
- Renders `<PromoCodeInput promotions={cart.promotions ?? []} />` below the items list, before the totals

### Server Actions

Added to `storefront/lib/medusa/checkout.ts`:

```ts
applyPromoCode(code: string): Promise<CartActionState>
removePromoCode(code: string): Promise<CartActionState>
```

Both actions:
- Validate input with `promoCodeSchema` (Zod: non-empty string, max 50 chars, uppercase-normalised)
- Resolve the active cart from the server-side session/cookie boundary, then update `/store/carts/:id/promotions`
- Call `revalidateCheckout()` on success
- Track analytics events (see below)
- Capture to Sentry on error

**New schema:** `promoCodeSchema` added to `storefront/lib/medusa/checkout-schemas.ts`

### Analytics Events

Three new events added to the `AnalyticsEvents` type map:

| Event | Properties |
|-------|-----------|
| `promo_code_applied` | `cart_id`, `code` |
| `promo_code_removed` | `cart_id`, `code` |
| `promo_code_failed` | `cart_id`, `code`, `error` |

Tracked server-side via `trackServer()` from `lib/analytics-server`.

### Discount Popup

**New file:** `storefront/components/common/discount-popup.tsx` (client component)

Props: `isAuthenticated: boolean`

Behavior:
- Only renders when `isAuthenticated` is `false`
- Auto-opens on mount after a 800ms delay (prevents flash on initial render)
- Checks `sessionStorage` for key `discount_popup_shown`; if set, does not open (resets on each new browser session — shown at most once per tab session)
- On open: sets `discount_popup_shown = "1"` in sessionStorage
- Dismissed by clicking the × button or clicking the backdrop

UI:
- Headless UI `Dialog` with TailwindUI Marketing > Overlays styling
- Headline: "10% off your first order"
- Body: brief copy encouraging account creation
- Primary CTA: "Create an account" → navigates to `/account?view=register`
- Secondary: "Maybe later" → dismisses

**Layout integration:**
- Existing main store layout reads customer session server-side
- Passes `isAuthenticated={!!customer}` to `<DiscountPopup>`
- No layout restructuring required

### Tests (Frontend)

**`storefront/e2e/promo-code.spec.ts`**
- Apply valid code → discount line appears in order summary, chip shown
- Apply invalid/expired code → inline error shown, no chip
- Remove applied code → chip disappears, discount line removed
- Attempt to manually apply `FIRST_PURCHASE` as ineligible user → blocked by validation hook, error shown in UI

**`storefront/e2e/discount-popup.spec.ts`**
- Unauthenticated visit → popup appears
- Dismiss → does not reappear within the same browser session (sessionStorage resets on tab/window close)
- Authenticated visit → popup never shown
- "Create an account" CTA navigates to `/account?view=register`

---

## Out of Scope

- Creating the `FIRST_PURCHASE` promotion in the Medusa admin (manual setup step)
- Newsletter campaigns or email notifications for first-purchase eligibility
- Multi-currency promotion amounts
