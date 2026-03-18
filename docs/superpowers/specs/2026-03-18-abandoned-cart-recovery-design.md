# Abandoned Cart Recovery — Design Spec

**Date:** 2026-03-18
**Scope:** MVP — single email, no discount, signed recovery links
**Reference:** https://docs.medusajs.com/resources/how-to-tutorials/tutorials/abandoned-cart

## Overview

Automated system that detects abandoned carts and sends a recovery email with a signed link to restore the cart session. Runs as a Medusa scheduled job every 15 minutes, targeting carts abandoned between 1 and 48 hours ago.

## Abandonment Criteria

A cart is "abandoned" when **all** of these are true:

1. `completed_at` is `null` — not converted to an order
2. `updated_at` is between 1 hour and 48 hours ago — recent enough to recover, not ancient history
3. `email` is not `null` — we need a recipient
4. `items` array has at least 1 item — empty carts aren't worth recovering
5. `metadata.abandoned_cart_notified` is not set — hasn't been emailed yet

The 1–48 hour window prevents blasting the entire cart history on the first deployment and avoids emailing stale carts from weeks or months ago.

## Architecture

```
Scheduled Job (every 15 min)
  → query.graph() for abandoned carts (paginated, 100/batch)
  → JS-filter: items.length > 0, no abandoned_cart_notified metadata
  → For each cart: sendAbandonedCartEmailWorkflow(container).run({ cart_id, email })

sendAbandonedCartEmailWorkflow:
  1. useQueryGraphStep        → Fetch full cart data (items, variants, products, customer)
  2. generateCartRecoveryTokenStep → HMAC-SHA256 signed recovery URL
  3. formatCartForEmailStep   → Transform cart → email-friendly data shape
  4. sendNotificationsStep    → Send via Resend (template: "abandoned-cart")
  5. updateCartsStep          → Set metadata.abandoned_cart_notified = ISO timestamp
```

**One workflow invocation per cart** for error isolation. If cart N fails, carts 1 through N-1 already have their metadata set and won't be re-emailed. The job logs the error and continues to the next cart.

## Scheduled Job

**File:** `backend/src/jobs/send-abandoned-cart-emails.ts`

**Schedule:** `*/15 * * * *` (every 15 minutes)

**Query:**

```typescript
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

const { data: carts, metadata: paginationMeta } = await query.graph({
  entity: "cart",
  fields: [
    "id", "email", "currency_code",
    "items.*", "items.variant.*", "items.variant.product.*",
    "metadata", "updated_at",
    "customer.first_name",
  ],
  filters: {
    completed_at: null,
    updated_at: {
      $lt: oneHourAgo,
      $gt: fortyEightHoursAgo,
    },
    email: { $ne: null },
  },
  pagination: { skip: offset, take: limit },
})
```

**Post-query JS filter:**

```typescript
const eligibleCarts = carts.filter(
  (cart) => cart.items?.length > 0 && !cart.metadata?.abandoned_cart_notified
)
```

Items/metadata checks can't be expressed in `query.graph()` filters (no `$exists` or array-length filter), so we filter in JS after fetching. The pagination + 48-hour window keeps the result set bounded.

**Error handling:** Each workflow invocation is wrapped in try/catch. One failed cart doesn't stop the rest. Errors are logged with the cart ID.

**Idempotency:** If the job runs twice before metadata is updated, the JS filter catches it on the second pass. After metadata is set, the cart is permanently excluded.

## Workflow — sendAbandonedCartEmailWorkflow

**File:** `backend/src/workflows/notifications/send-abandoned-cart-email.ts`

**Input:** `{ cart_id: string, email: string }`

### Step 1: useQueryGraphStep

Fetch full cart data by ID. Fields needed:

```typescript
fields: [
  "id", "email", "currency_code",
  "items.*", "items.variant.*", "items.variant.product.*",
  "metadata",
  "customer.first_name",
  "item_subtotal",
]
```

### Step 2: generateCartRecoveryTokenStep (custom)

**File:** `backend/src/workflows/steps/generate-cart-recovery-token.ts`

- Input: `{ cart_id: string }`
- Compute: `HMAC-SHA256(cart_id, CART_RECOVERY_SECRET)` using Node.js built-in `crypto`
- Output: `{ token: string, recoveryUrl: string }`
- Recovery URL format: `${STOREFRONT_URL}/cart/recover/${cart_id}?token=${hmacHexDigest}`
- Uses `resolveStorefrontUrl()` from `subscribers/_helpers/resolve-urls.ts` for the base URL

### Step 3: formatCartForEmailStep (custom)

**File:** `backend/src/workflows/steps/format-cart-for-email.ts`

Transforms cart data into the email template's data shape. Reuses existing `_format-helpers.ts`:

- `createCurrencyFormatter(cart.currency_code)` for money formatting
- `formatItem(item, formatMoney)` for each line item

**Customer name:** Use `cart.customer.first_name` if available, otherwise omit (template falls back to "Hi there,").

**Output type:**

```typescript
type AbandonedCartEmailData = {
  subject: string         // "You left something behind!"
  customerName?: string   // cart.customer.first_name or undefined
  items: {
    name: string          // Product title
    variant?: string      // Variant title (e.g., "Blue / Large")
    quantity: number
    price: string         // Formatted (e.g., "$49.99")
    imageUrl?: string     // Product thumbnail
  }[]
  subtotal: string        // Formatted cart item_subtotal
  recoveryUrl: string     // HMAC-signed recovery link
  currencyCode: string    // For any template-side formatting
}
```

### Step 4: sendNotificationsStep (core)

```typescript
sendNotificationsStep([{
  to: email,
  channel: "email",
  template: "abandoned-cart",
  data: formattedData,
  trigger_type: "cart.abandoned",
  resource_id: cart_id,
  resource_type: "cart",
}])
```

### Step 5: updateCartsStep (core)

```typescript
updateCartsStep([{
  id: cart_id,
  metadata: {
    ...existingMetadata,
    abandoned_cart_notified: new Date().toISOString(),
  },
}])
```

**Rollback consideration:** If step 4 succeeds but step 5 fails, the cart could receive a duplicate email on the next job run. Acceptable for MVP — better a duplicate than losing the notification flag silently. The failure will be logged.

## Cart Recovery Route (Storefront)

**File:** `storefront/app/cart/recover/[id]/route.ts`

**Type:** Route Handler (GET)

**Flow:**

1. Extract `cart_id` from path params, `token` from query string
2. Verify HMAC: recompute `HMAC-SHA256(cart_id, CART_RECOVERY_SECRET)` and timing-safe compare against `token`
3. If invalid token or missing params → 404 (don't reveal whether the cart exists)
4. Call `sdk.store.cart.retrieve(cart_id)` to confirm the cart still exists and isn't completed
5. If cart is missing or completed → redirect to `/`
6. Set `_medusa_cart_id` cookie via the existing `setCartId()` helper from `lib/medusa/cookies.ts`
7. Redirect to `/cart`

**Security properties:**

- HMAC tokens can't be guessed or enumerated
- Timing-safe comparison prevents timing attacks (`crypto.timingSafeEqual`)
- Invalid tokens get a generic 404
- Works for both guest and authenticated carts
- No auth required — the signed token is the proof of authorization

**Edge case — existing cart:** If the visitor already has a different active cart, the recovery link overwrites their cart cookie. This is expected behavior — they clicked the link because they want this cart. The old cart remains in Medusa as an orphaned cart.

## Email Template

**File:** `backend/src/modules/resend/templates/abandoned-cart.tsx`

React Email component following existing template patterns. Single-CTA layout:

1. **Greeting** — "Hi {customerName}," or "Hi there," if no name
2. **Item table** — thumbnail, product name, variant, quantity, formatted price
3. **Subtotal line**
4. **Primary CTA button** — "Return to your cart" → recovery URL
5. **Footer** — "If you've already completed your purchase, please ignore this email."

## File Inventory

### New backend files

| File | Purpose |
|------|---------|
| `src/jobs/send-abandoned-cart-emails.ts` | Scheduled job (every 15 min) |
| `src/workflows/notifications/send-abandoned-cart-email.ts` | Workflow: query → token → format → send → update metadata |
| `src/workflows/steps/generate-cart-recovery-token.ts` | HMAC-SHA256 token generation step |
| `src/workflows/steps/format-cart-for-email.ts` | Cart → email data transform step |
| `src/modules/resend/templates/abandoned-cart.tsx` | React Email template |

### New storefront files

| File | Purpose |
|------|---------|
| `app/cart/recover/[id]/route.ts` | Recovery route handler (verify HMAC, set cookie, redirect) |

### Modified files

| File | Change |
|------|--------|
| `src/modules/resend/service.ts` | Register `"abandoned-cart"` in template map |

## Environment Variables

| Variable | Required | Used by | Purpose |
|----------|----------|---------|---------|
| `CART_RECOVERY_SECRET` | Yes (for this feature) | Backend + Storefront | HMAC signing/verification for recovery links |

No new npm dependencies. Uses Node.js built-in `crypto` module for HMAC operations.

## Future Enhancements (Not in MVP)

- **Drip sequence:** 1h reminder → 24h follow-up with discount → 48h final chance
- **Dynamic discount:** Auto-generate unique promo codes per cart
- **Analytics:** Track recovery rate (carts recovered / emails sent)
- **Unsubscribe:** Proper email preference management
- **A/B testing:** Subject lines, send timing, discount amounts
- **Admin dashboard widget:** Abandoned cart metrics and manual re-send
