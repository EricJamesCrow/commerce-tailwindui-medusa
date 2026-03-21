# Medusa PostHog Analytics Module — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Backend only — no storefront changes

## Problem

The storefront has 45 typed PostHog events covering client-side interactions and server-side actions triggered by the storefront. But the Medusa backend has zero analytics integration. Backend-only events — order cancellations, refunds, shipments, invoice generation, abandoned cart emails — are invisible to PostHog. This creates blind spots in the commerce funnel: we can see that a customer started checkout but not whether their order was later refunded, or that an abandoned cart email was sent but not whether it led to a recovered order.

## Solution

Integrate the official `@medusajs/analytics-posthog` module into the Medusa backend, following Medusa's Analytics Module pattern. Track 8 server-side events that complement (not duplicate) the storefront's existing 45 events.

## Approach

**Medusa Analytics Module** (`@medusajs/analytics-posthog`) — the official first-party integration. Registers as a module in `medusa-config.ts`, resolves from the container via `Modules.ANALYTICS`, and provides a `.track()` method. Conditional on `POSTHOG_EVENTS_API_KEY` — graceful no-op when not configured.

Alternatives considered and rejected:
- **Direct `posthog-node` SDK:** Bypasses Medusa's module system, one-off pattern that doesn't match the codebase.
- **Pipe to storefront PostHog:** Misses events with no storefront equivalent (admin-triggered cancellations, refunds, fulfillments).

## Actor ID Strategy

The PostHog analytics provider requires `actor_id` on every `.track()` call. Each event must define its actor:

| Event | `actor_id` | Fallback for guests/system |
|-------|-----------|---------------------------|
| `order_placed` | `order.customer_id` | `order.email` (guest orders have no customer ID but always have email) |
| `order_canceled` | `order.customer_id` | `order.email` |
| `customer_created` | `customer.id` | Always present |
| `payment_refunded` | `order.customer_id` (via payment → order) | `order.email` |
| `shipment_created` | `order.customer_id` (via fulfillment → order) | `order.email` |
| `review_created` | `review.customer_id` | Always present (reviews require auth) |
| `invoice_generated` | `order.customer_id` | `order.email` |
| `abandoned_cart_email_sent` | `cart.customer_id` | `cart.email` (abandoned cart emails require an email) |

The shared tracking step must handle this: if `actor_id` is falsy, it falls back to the provided `actor_fallback` (email), and if both are empty, it logs a warning and skips the event rather than throwing.

## Event Catalog

### 1. `order_placed`

| Field | Details |
|-------|---------|
| **Source** | `order.placed` subscriber |
| **actor_id** | `order.customer_id` or `order.email` |
| **Properties** | `order_id`, `total`, `item_count`, `currency_code`, `customer_id`, `is_recovered_cart` |
| **Notes** | `is_recovered_cart`: The abandoned cart job sets `abandoned_cart_notified` on **cart** metadata, not order metadata. Medusa v2 does not copy cart metadata to the order on completion. The tracking workflow must query the cart via `order.cart_id` to check `cart.metadata?.abandoned_cart_notified`. This is one additional query but only runs for orders — acceptable overhead. |

### 2. `order_canceled`

| Field | Details |
|-------|---------|
| **Source** | `order.canceled` subscriber |
| **actor_id** | `order.customer_id` or `order.email` |
| **Properties** | `order_id`, `total`, `currency_code`, `customer_id` |
| **Notes** | Admin-triggered. No storefront equivalent. |

### 3. `customer_created`

| Field | Details |
|-------|---------|
| **Source** | `customer.created` subscriber |
| **actor_id** | `customer.id` |
| **Properties** | `customer_id`, `has_account` |
| **Notes** | Tracks `has_account` boolean from the customer record. In Medusa v2, explicit signups create customers with `has_account: true`, while guest checkout creates customers with `has_account: false` initially. This is a simpler and more reliable signal than trying to infer `registration_source`. Downstream analysis can correlate `has_account: false` → later `has_account: true` transitions via separate events if needed. |

### 4. `payment_refunded`

| Field | Details |
|-------|---------|
| **Source** | `payment.refunded` subscriber |
| **actor_id** | `order.customer_id` or `order.email` (via payment → order lookup) |
| **Properties** | `payment_id`, `order_id`, `amount`, `currency_code` |
| **Notes** | Admin-triggered. The tracking workflow fetches the payment collection → order to get `order_id`, `currency_code`, and the actor. |

### 5. `shipment_created`

| Field | Details |
|-------|---------|
| **Source** | `shipment.created` subscriber |
| **actor_id** | `order.customer_id` or `order.email` (via fulfillment → order lookup) |
| **Properties** | `order_id`, `fulfillment_id`, `item_count` |
| **Notes** | The analytics call must be placed **before** the existing `no_notification` early return in the subscriber. Analytics tracking is independent of customer notification preferences — a shipment is a shipment regardless of notification settings. The subscriber restructuring: analytics first, then `no_notification` check, then email workflow. |

### 6. `review_created`

| Field | Details |
|-------|---------|
| **Source** | `product_review.created` subscriber |
| **actor_id** | `review.customer_id` |
| **Properties** | `product_id`, `rating`, `has_images` |
| **Notes** | The event payload only includes `id` and `product_id`. The tracking workflow resolves the `productReviewModuleService` from the container (not `useQueryGraphStep` — `product_review` is a custom module that may not be in the query graph). Calls `service.retrieveProductReview(id, { relations: ["images"] })` to get `rating` and image count. |

### 7. `invoice_generated`

| Field | Details |
|-------|---------|
| **Source** | `generate-invoice-pdf` workflow (called from order confirmation workflow and storefront download route) |
| **actor_id** | `order.customer_id` or `order.email` |
| **Properties** | `order_id`, `invoice_number`, `delivery_method` |
| **Notes** | `delivery_method` cannot be determined inside `generateInvoicePdfWorkflow` since it doesn't know its calling context. Instead, extend the workflow's input type to accept an optional `delivery_method: "attachment" \| "link"` field. The order confirmation workflow passes `"attachment"`, the storefront download route passes `"link"`. Defaults to `"unknown"` if not provided. |

### 8. `abandoned_cart_email_sent`

| Field | Details |
|-------|---------|
| **Source** | `send-abandoned-cart-emails` scheduled job |
| **actor_id** | `cart.customer_id` or `cart.email` |
| **Properties** | `cart_id`, `hours_abandoned`, `item_count` |
| **Notes** | Tracked in the scheduled job after each successful `sendAbandonedCartEmailWorkflow` run. The job already has `cart` in scope from its query (which fetches `items.*`), so `item_count` is `cart.items.length`. `hours_abandoned` is computed from `cart.updated_at` vs current time. The tracking call resolves the analytics service directly from the container (not a workflow) since we're already inside the job loop. |

## Architecture

### Shared Tracking Step

One reusable workflow step that resolves the Analytics Module and calls `.track()`:

```
backend/src/workflows/steps/track-analytics-event.ts
```

```typescript
// Pseudocode — not final implementation
const trackAnalyticsEventStep = createStep(
  "track-analytics-event",
  async ({ event, actor_id, actor_fallback, properties }, { container }) => {
    // Graceful no-op when analytics module is not registered
    let analytics
    try {
      analytics = container.resolve(Modules.ANALYTICS)
    } catch {
      // Module not registered (POSTHOG_EVENTS_API_KEY not set) — skip silently
      return
    }

    const resolvedActorId = actor_id || actor_fallback
    if (!resolvedActorId) {
      container.resolve("logger").warn(
        `[analytics] Skipping ${event}: no actor_id or fallback`
      )
      return
    }

    await analytics.track({ event, actor_id: resolvedActorId, properties })
  }
)
```

This step is fire-and-forget by design. It handles three failure modes:
1. **Module not registered** (no API key) — silent no-op via container resolution catch
2. **No actor ID** — logs warning and skips (PostHog provider throws without `actor_id`)
3. **PostHog API error** — caught by the subscriber's outer try/catch, logged, and ignored

### Per-Event Workflows

Each event gets a thin workflow in `backend/src/workflows/analytics/`:

```
backend/src/workflows/analytics/
├── track-order-placed.ts
├── track-order-canceled.ts
├── track-customer-created.ts
├── track-payment-refunded.ts
├── track-shipment-created.ts
└── track-review-created.ts
```

Each workflow:
1. Accepts minimal input from the subscriber (usually just an entity ID)
2. Fetches required data via `useQueryGraphStep`
3. Transforms data into event properties
4. Calls `trackAnalyticsEventStep`

### Invoice & Abandoned Cart (No Separate Workflow)

- **`invoice_generated`**: A tracking step added directly to the `generateInvoicePdfWorkflow`. The workflow already has all the data; no extra fetch needed.
- **`abandoned_cart_email_sent`**: Tracked inline in the scheduled job after each successful email send. The job already has cart data in scope.

### Subscriber Integration

Existing subscribers gain a second workflow call alongside their email workflow:

```typescript
// order-placed.ts subscriber (updated)
export default async function orderPlacedHandler({ event: { data }, container }) {
  const logger = container.resolve("logger")

  // Existing: send email
  try {
    await sendOrderConfirmationWorkflow(container).run({ input: { id: data.id } })
  } catch (error) { logger.error(...) }

  // New: track analytics (fire-and-forget)
  try {
    await trackOrderPlacedWorkflow(container).run({ input: { order_id: data.id } })
  } catch (error) { logger.error(...) }
}
```

Analytics tracking is always wrapped in its own try/catch. A PostHog failure logs a warning and moves on.

## Module Configuration

```typescript
// medusa-config.ts — conditional on POSTHOG_EVENTS_API_KEY
...(process.env.POSTHOG_EVENTS_API_KEY
  ? [
      {
        resolve: "@medusajs/medusa/analytics",
        options: {
          providers: [
            {
              resolve: "@medusajs/analytics-posthog",
              id: "posthog",
              options: {
                posthogEventsKey: process.env.POSTHOG_EVENTS_API_KEY,
                posthogHost: process.env.POSTHOG_HOST,
              },
            },
          ],
        },
      },
    ]
  : []),
```

With a startup warning when not configured:

```typescript
if (!process.env.POSTHOG_EVENTS_API_KEY) {
  console.warn("[medusa-config] POSTHOG_EVENTS_API_KEY is not set — backend analytics will be disabled")
}
```

## Package Dependencies

Add to `backend/package.json`:

```json
"@medusajs/analytics-posthog": "^2.13.1"
```

This package depends on `posthog-node` transitively. No need to install `posthog-node` directly.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `POSTHOG_EVENTS_API_KEY` | No (graceful degradation) | — | PostHog project API key for server-side events |
| `POSTHOG_HOST` | No | `https://eu.i.posthog.com` | PostHog API host |

Both must be added to:
- Local `.env` for development
- Railway environment variables for production

## Storefront Overlap Analysis

No event duplication. The storefront tracks user-initiated actions (add to cart, checkout steps, search, UI interactions). The backend tracks system-confirmed outcomes and admin-triggered actions:

| Storefront tracks | Backend tracks |
|-------------------|----------------|
| `order_completed` (client-side confirmation page) | `order_placed` (server-side authoritative) |
| `review_submitted` (form submission) | `review_created` (server-side persisted) |
| `abandoned_cart_recovered` (recovery link clicked) | `abandoned_cart_email_sent` (email dispatched) + `order_placed.is_recovered_cart` (conversion) |
| — | `order_canceled`, `payment_refunded`, `shipment_created`, `invoice_generated` |

## Testing

### Build verification
1. Run `cd backend && bun run build` — must pass with no type errors

### Graceful degradation
2. Start backend **without** `POSTHOG_EVENTS_API_KEY` — verify startup warning is logged and no crashes
3. Place an order without the key set — verify the tracking step silently no-ops (check logs for absence of errors)

### Event verification (with key set)
4. Start backend with `POSTHOG_EVENTS_API_KEY` set
5. Place an order → verify `order_placed` in PostHog Live Events
6. Cancel an order from admin → verify `order_canceled`
7. Create a customer account → verify `customer_created` with `has_account: true`
8. Create a shipment from admin → verify `shipment_created`
9. Submit a product review → verify `review_created`
10. Download an invoice → verify `invoice_generated` with `delivery_method: "link"`
11. Check all events have valid `actor_id` values in PostHog (no empty distinct IDs)

## Out of Scope

- Storefront changes (already has PostHog)
- PostHog dashboards or saved insights (manual setup in PostHog UI)
- User identification / linking backend events to storefront sessions (different tracking contexts)
- Admin UI events (would require a separate admin analytics integration)
