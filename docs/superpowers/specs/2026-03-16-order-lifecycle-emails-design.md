# Order Lifecycle Emails — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Stack:** 3 (follows Stack 2: auth & admin emails)

## Summary

Implement the remaining four order lifecycle emails for CrowCommerce, following the established subscriber → workflow → template pattern. Each email gets its own independent subscriber, workflow, and React Email template.

**Why workflows (not subscriber-only)?** Unlike Stack 2's auth emails (which received all needed data in event payloads), these emails require multi-entity data fetching via `useQueryGraphStep`, which is only available inside workflows.

### Emails in scope

| # | Email | Medusa v2 Event | Payload |
|---|---|---|---|
| 1 | Shipping Confirmation | `shipment.created` | `{ id (fulfillment_id), no_notification }` |
| 2 | Order Canceled | `order.canceled` | `{ id (order_id) }` |
| 3 | Refund Confirmation | `payment.refunded` | `{ id (payment_id) }` |
| 4 | Admin New Order Alert | `order.placed` | `{ id (order_id) }` |

### Out of scope

- **Payment failure emails** — No native Medusa v2 event exists. Stripe Payment Element surfaces failures client-side. Revisit when there's data on async failure frequency.
- **Fulfillment created email** (`order.fulfillment_created`) — "preparing your order" notification. Can be added later if customers want packing-stage visibility.
- **Delivery confirmation** (`delivery.created`) — Can be added later.

## Architecture

### Pattern

All four emails follow the same architecture as the existing `order-placed` email:

```
Event emitted
  → Subscriber (extracts IDs, checks skip conditions)
    → Workflow (fetches data via useQueryGraphStep, formats, sends)
      → Template (React Email component renders HTML)
```

### Approach: Four Independent Workflows

Each email is fully self-contained. No shared workflow router, no conditional branching. The existing `formatOrderForEmailStep` is reused where applicable.

**Rationale:** Matches existing codebase pattern. Independent testing, independent failure handling, no workflow composition complexity.

## File Structure

### New files (12)

```
backend/src/
├── subscribers/
│   ├── shipment-created.ts              # listens to shipment.created
│   ├── order-canceled.ts                # listens to order.canceled
│   ├── payment-refunded.ts              # listens to payment.refunded
│   └── admin-order-alert.ts             # listens to order.placed
│
├── workflows/notifications/
│   ├── send-shipping-confirmation.ts
│   ├── send-order-canceled.ts
│   ├── send-refund-confirmation.ts
│   └── send-admin-order-alert.ts
│
└── modules/resend/templates/
    ├── shipping-confirmation.tsx
    ├── order-canceled.tsx
    ├── refund-confirmation.tsx
    └── admin-order-alert.tsx
```

### Modified files (1)

```
backend/src/modules/resend/service.ts    # register 4 new templates in template map
```

### Reused existing code

- `formatOrderForEmailStep` — reused by shipping, canceled, and admin alert workflows. **Known limitation:** outputs `shippingAddress` only (no `billingAddress`) and hardcodes `paymentMethod: "Card"`. The admin alert workflow should extract `billing_address` separately in its `transform` step and pass it directly to the template.
- `OrderSummary`, `AddressBlock` — reused commerce components in templates
- `Header`, `Footer`, `Tailwind`, `Body`, `Button`, `Text` — shared template components
- `BaseTemplateProps`, `getEmailConfig()` — shared config
- `resolveStorefrontUrl()`, `resolveAdminUrl()` — URL helpers from `_helpers/resolve-urls.ts`

**Note on LineItems:** The existing `order-confirmation.tsx` renders items inline rather than using the shared `LineItems` component from `_components/line-items.tsx`. New templates should follow whichever pattern is cleaner for their needs. The `LineItems` component uses a simpler `LineItem` interface; if variant/image info is needed, use the inline approach with the formatted step output.

## Data Flow Per Workflow

### 1. Shipping Confirmation (`shipment.created`)

**Why `shipment.created` over `order.fulfillment_created`?** `order.fulfillment_created` fires when items are marked for fulfillment (picking/packing). `shipment.created` fires later when tracking info is assigned. For a "your order has shipped" email with a tracking link, the shipment event is the right trigger. The tradeoff is that `shipment.created` only provides a fulfillment ID (not an order ID), requiring a cross-module query.

**Cross-module query strategy:** Fulfillments and orders live in separate Medusa modules linked via `order-fulfillment`. The query graph can resolve cross-module links via dot notation (`fulfillment → order`). If this traversal fails at implementation time, fall back to a two-step approach: (1) query fulfillment for tracking data, (2) use the fulfillment's linked order ID to query order details separately. Verify at runtime.

```
Subscriber receives: { id: fulfillment_id, no_notification }
  → if no_notification === true → skip
  →
Workflow: send-shipping-confirmation({ fulfillment_id })
  →
useQueryGraphStep({
  entity: "fulfillment",
  fields: [
    "id", "tracking_numbers", "labels.*",
    "items.*",
    "order.id", "order.display_id", "order.email", "order.created_at",
    "order.currency_code",
    "order.items.*",
    "order.shipping_address.*",
    "order.total", "order.subtotal", "order.item_total",
    "order.item_subtotal", "order.shipping_total", "order.tax_total"
  ],
  filters: { id: fulfillment_id }
})
  →
formatOrderForEmailStep (reused)
  →
transform → notification shape with tracking_numbers + order details
  →
sendNotificationsStep → template: "shipping-confirmation"
  (include trigger_type: "shipment.created", resource_id: order.id, resource_type: "order")
```

**Notes:**
- `tracking_numbers` is an array on the fulfillment entity
- Template renders first tracking number as primary; falls back to "on its way" message if empty

### 2. Order Canceled (`order.canceled`)

```
Subscriber receives: { id: order_id }
  →
Workflow: send-order-canceled({ order_id })
  →
useQueryGraphStep({
  entity: "order",
  fields: [
    "id", "display_id", "email", "created_at", "currency_code",
    "items.*",
    "shipping_address.*",
    "total", "item_total", "item_subtotal",
    "payment_collections.payments.refunds.*",
    "payment_collections.payments.amount",
    "payment_collections.payments.currency_code"
  ],
  filters: { id: order_id }
})
  →
formatOrderForEmailStep (reused)
  →
transform → compute refund status:
  - Sum refunds across all payments
  - If refunds exist: "A refund of $X has been issued"
  - If no refunds: "If you were charged, a refund will be processed shortly"
  →
sendNotificationsStep → template: "order-canceled"
  (include trigger_type: "order.canceled", resource_id: order.id, resource_type: "order")
```

### 3. Refund Confirmation (`payment.refunded`)

```
Subscriber receives: { id: payment_id }
  →
Workflow: send-refund-confirmation({ payment_id })
  →
useQueryGraphStep({
  entity: "payment",
  fields: [
    "id", "amount", "currency_code",
    "refunds.id", "refunds.amount", "refunds.created_at", "refunds.note",
    "refunds.refund_reason.label",  // verify this relation exists at runtime; omit reason from email if unavailable
    "payment_collection.order.id",
    "payment_collection.order.display_id",
    "payment_collection.order.email"
  ],
  filters: { id: payment_id }
})
  →
transform → extract most recent refund, order email, order display_id
  → if no order email → skip with warning log
  →
NEW: formatRefundForEmailStep → formats refund amount, date, reason
  →
sendNotificationsStep → template: "refund-confirmation"
  (include trigger_type: "payment.refunded", resource_id: payment.id, resource_type: "payment")
```

**Notes:**
- Does NOT reuse `formatOrderForEmailStep` — starts from payment, not order
- New `formatRefundForEmailStep` handles refund-specific formatting
- Intentionally minimal template (no line items)

### 4. Admin New Order Alert (`order.placed`)

**Dual subscriber note:** This subscriber coexists with the existing `order-placed.ts` subscriber (which sends customer order confirmation). Both listen to `order.placed` independently. Medusa's event bus dispatches to all subscribers; no ordering guarantee is needed and no conflict arises.

```
Subscriber receives: { id: order_id }
  → read ADMIN_ORDER_EMAILS env var
  → if unset or empty → log at debug level (expected when not configured), skip
  → split on "," → trim whitespace → lowercase each address
  →
Workflow: send-admin-order-alert({ order_id, admin_emails: string[] })
  →
useQueryGraphStep({
  entity: "order",
  fields: [
    "id", "display_id", "email", "created_at", "currency_code",
    "items.*",
    "shipping_address.*", "billing_address.*",
    "total", "item_total", "item_subtotal",
    "shipping_total", "tax_total", "discount_total"
  ],
  filters: { id: order_id }
})
  →
formatOrderForEmailStep (reused — provides shippingAddress, items, totals)
  →
transform → extract billing_address separately from raw order data (formatOrderForEmailStep
  doesn't include it), format as Address type. Map each admin email to a separate
  notification object with full order details + billingAddress.
  →
sendNotificationsStep → template: "admin-order-alert"
  (include trigger_type: "order.placed", resource_id: order.id, resource_type: "order")
```

**Notes:**
- Subscriber parses `ADMIN_ORDER_EMAILS` env var, lowercases, and passes array to workflow
- Transform maps each admin email to a separate notification object
- Billing address extracted in the transform step (not from `formatOrderForEmailStep` which only outputs `shippingAddress`)

## Template Content

### Shipping Confirmation

**Subject:** `Your order #${displayId} has shipped`

| Section | Content |
|---|---|
| Header | Logo (LeftAligned) |
| Headline | "Your order is on its way!" |
| Tracking block | Tracking number (linked if URL derivable), carrier name if available. Fallback: "Your order has shipped — tracking details will be available soon" |
| Order summary | `LineItems` + `OrderSummary` (reused from order confirmation) |
| Shipping address | `AddressBlock` (reused) |
| CTA button | "Track your order" (tracking URL) or "View your order" (order detail page) |
| Footer | Standard legal + social |

### Order Canceled

**Subject:** `Your order #${displayId} has been canceled`

| Section | Content |
|---|---|
| Header | Logo (LeftAligned) |
| Headline | "Your order has been canceled" |
| Refund status | Conditional: "A refund of $X has been issued to your original payment method" OR "If you were charged, a refund will be processed shortly." |
| Order summary | `LineItems` + `OrderSummary` showing what was canceled |
| Support CTA | "If you have questions, contact us at {supportEmail}" |
| CTA button | "Continue shopping" → storefront URL |
| Footer | Standard |

### Refund Confirmation

**Subject:** `Refund issued for order #${displayId}`

| Section | Content |
|---|---|
| Header | Logo (LeftAligned) |
| Headline | "Your refund has been processed" |
| Refund details | Amount, currency, date processed. Refund reason label if present. |
| Order reference | Order number + link to order detail page (no full line items) |
| Timeline note | "Refunds typically appear on your statement within 5-10 business days depending on your bank." |
| Footer | Standard |

**Intentionally minimal** — no line items, no address. This is a refund receipt, not an order restatement.

### Admin New Order Alert

**Subject:** `New order #${displayId} — $${total}`

| Section | Content |
|---|---|
| Header | Logo (LeftAligned) |
| Headline | "New order received" |
| Customer info | Email, name (from shipping address) |
| Order summary | `LineItems` + `OrderSummary` (full detail) |
| Both addresses | Shipping + billing via `AddressBlock` |
| CTA button | "View in admin" → `{adminUrl}/orders/${orderId}` |
| Footer | Minimal (no social links, no legal — internal email) |

## Environment Variables

### New

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ADMIN_ORDER_EMAILS` | No | — | Comma-separated admin emails for new order alerts |

### Existing (used by new emails)

| Variable | Accessed via | Purpose |
|---|---|---|
| `RESEND_API_KEY` | medusa-config.ts (provider option) | Resend notification provider |
| `RESEND_FROM_EMAIL` | medusa-config.ts (provider option) | Sender address |
| `STOREFRONT_URL` | `resolveStorefrontUrl()` helper | CTA links to storefront pages |
| Admin URL | `resolveAdminUrl(container)` helper | Admin alert CTA (reads from `configModule.admin.backendUrl` + `configModule.admin.path`, not an env var) |

## Edge Cases & Error Handling

### Skip conditions (subscriber level)

| Email | Skip when |
|---|---|
| Shipping confirmation | `no_notification === true` |
| Order canceled | Order has no email |
| Refund confirmation | Payment can't be traced to an order (orphan payment) |
| Admin alert | `ADMIN_ORDER_EMAILS` env var unset or empty |

Skips log with context (event name, entity ID, reason). Use `logger.debug()` for expected states (e.g., `ADMIN_ORDER_EMAILS` not configured) and `logger.warn()` for unexpected states (e.g., order missing email, orphan payment).

### Workflow-level guards

- **Missing email on order:** `transform` step validates email exists, throws `MedusaError(NOT_FOUND)` — matches existing pattern.
- **Empty query result:** Validate query graph returned at least one entity. Log + early return if not.
- **Refund with broken order chain:** If `payment → payment_collection → order` traversal fails, log warning and skip. Don't throw — refunds can exist without orders in edge cases.

### Idempotency

- Medusa events can fire more than once (worker retries). These emails are informational, so duplicate sends are acceptable.
- No deduplication logic. Can add a `sent_notifications` log table later if needed.

## Template Registration

```typescript
// backend/src/modules/resend/service.ts
private templates: Record<string, React.FC<any>> = {
  "order-confirmation": OrderConfirmation,
  "password-reset": PasswordReset,
  "invite-user": InviteUser,
  "welcome": Welcome,
  "shipping-confirmation": ShippingConfirmation,        // NEW
  "order-canceled": OrderCanceled,                      // NEW
  "refund-confirmation": RefundConfirmation,            // NEW
  "admin-order-alert": AdminOrderAlert,                 // NEW
}
```

## Testing Strategy

### Manual testing

1. **Shipping confirmation:** Create fulfillment in admin → add shipment with tracking → verify email
2. **Order canceled:** Cancel order in admin → verify email with refund status
3. **Refund confirmation:** Issue refund in admin → verify email
4. **Admin alert:** Place order via storefront → verify admin receives alert

### Email preview

All templates include `.PreviewProps` for `react-email dev` server (`bun run dev:emails`).

**PreviewProps should include:**
- **Shipping confirmation:** Sample order with 2-3 items, formatted prices, a tracking number (`"1Z999AA10123456784"`), and a shipping address. Also include a no-tracking variant.
- **Order canceled:** Sample canceled order with items, one variant showing refund issued ($45.00), one showing "refund pending."
- **Refund confirmation:** Refund of $25.00 USD on order #1042, with a refund reason ("Item damaged"), and a no-reason variant.
- **Admin alert:** Full order with items, both addresses, customer email, totals including discount and tax.

### Automated (future)

- Subscriber unit tests: mock event payload, verify workflow invoked with correct args
- Workflow integration tests: mock query graph responses, verify notification shape
- Template snapshot tests: render with preview props, compare HTML output
