# Email Infrastructure Architecture

> Architecture reference for the CrowCommerce email notification system as built. Stacks 1–4 are shipped (9 templates live). Stacks 5–7 are deferred.

---

## Overview

Event-driven email notification system built on **Resend** (delivery), **React Email** (templates), and **Medusa v2's event bus** (triggers). The pipeline is:

```
Medusa Event → Subscriber → Workflow → Format Step → sendNotificationsStep → Resend Provider → Template Render → Resend API
```

Every email follows this indirection pattern — subscribers never send directly. This keeps event handling thin, formatting testable, and delivery swappable.

---

## Architecture Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Medusa Event │────▶│  Subscriber  │────▶│     Workflow      │────▶│  Format Step(s)  │────▶│ sendNotifications │
│  (e.g.       │     │ (thin, fires │     │ (query graph,    │     │ (Medusa → email  │     │     Step          │
│  order.placed│     │  workflow)   │     │  orchestration)  │     │  shape)          │     │ (channel: email) │
└─────────────┘     └──────────────┘     └──────────────────┘     └──────────────────┘     └────────┬────────┘
                                                                                                    │
                                                                                                    ▼
                                                                                          ┌─────────────────┐
                                                                                          │ Resend Provider  │
                                                                                          │ (template lookup │
                                                                                          │  → validate →    │
                                                                                          │  render → send)  │
                                                                                          └─────────────────┘
```

**Scheduled path** (abandoned cart): Cron job → query eligible carts → workflow per cart → same pipeline from Format Step onward.

---

## Notification Provider

**File:** `backend/src/modules/resend/service.ts`

`ResendNotificationProviderService` extends `AbstractNotificationProviderService` with identifier `"notification-resend"`.

**`send()` method flow:**
1. Look up template ID in the registry
2. Validate data with the template's type guard (`isValidXxxData()`)
3. Render React Email component to HTML via `@react-email/render`
4. Send via Resend API with subject, attachments, and email options

**Subject precedence:** caller-provided → registry default → auto-generated from template ID.

**Graceful degradation:** Missing template, failed validation, and render errors are all caught, logged, and return `{}` — no crash, no unhandled rejection.

**Conditional registration** in `medusa-config.ts`:

```typescript
...(process.env.RESEND_API_KEY
  ? [{ resolve: "@medusajs/medusa/notification", options: { providers: [
      { resolve: "./src/modules/resend", id: "resend", options: {
        channels: ["email"],
        api_key: process.env.RESEND_API_KEY,
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      }}
    ]}}]
  : [])
```

If `RESEND_API_KEY` is not set, the entire module is skipped.

**Email options** (caller-controlled per notification):

```typescript
type EmailOptions = {
  from?: string
  replyTo?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  tags?: Array<{ name: string; value: string }>
  text?: string
  headers?: Record<string, string>
  scheduledAt?: string
}
```

---

## Template Registry

**9 registered templates** in `service.ts`, each with a component, type guard, and default subject:

| Template ID | Component | Validation | Default Subject |
|---|---|---|---|
| `order-confirmation` | `OrderConfirmation` | `isValidOrderConfirmationData()` | "Order Confirmed" |
| `shipping-confirmation` | `ShippingConfirmation` | `isValidShippingConfirmationData()` | "Your Order Has Shipped" |
| `order-canceled` | `OrderCanceled` | `isValidOrderCanceledData()` | "Order Canceled" |
| `refund-confirmation` | `RefundConfirmation` | `isValidRefundConfirmationData()` | "Refund Processed" |
| `password-reset` | `PasswordReset` | `isValidPasswordResetData()` | "Reset Your Password" |
| `invite-user` | `InviteUser` | `isValidInviteUserData()` | "You've Been Invited" |
| `welcome` | `Welcome` | `isValidWelcomeData()` | "Welcome!" |
| `admin-order-alert` | `AdminOrderAlert` | `isValidAdminOrderAlertData()` | "New Order Received" |
| `abandoned-cart` | `AbandonedCart` | `isValidAbandonedCartData()` | "You Left Something Behind" |

Each type guard checks required fields at runtime (e.g., `orderNumber` is a string, `items` is a non-empty array). This prevents rendering crashes from malformed notification data.

---

## Templates

All templates extend `BaseTemplateProps`:

```typescript
interface BaseTemplateProps {
  theme?: "light" | "dark"
  brandConfig?: Partial<EmailBrandConfig>
}
```

**Shared types** (from `templates/types.ts`):

- `CommerceLineItem` — `{ name, quantity?, price, imageUrl?, variant?, sku?, thumbnail? }`
- `Address` — `{ name, line1, line2?, city, state?, postalCode, country, phone? }`

### Template manifest

| Template | Key Props | Purpose |
|---|---|---|
| **OrderConfirmation** | `orderNumber`, `orderDate`, `items`, `subtotal`, `shipping`, `total`, `shippingAddress` | Post-purchase confirmation |
| **ShippingConfirmation** | `orderNumber`, `items`, `trackingNumber?`, `carrier?`, `trackingUrl?`, `shippingAddress` | Fulfillment notification |
| **OrderCanceled** | `orderNumber`, `items`, `cancelReason?`, refund messaging | Cancellation with refund status |
| **RefundConfirmation** | `orderNumber`, `refundAmount`, `refundDate`, `refundReason?`, `orderUrl?` | Refund processed notification |
| **PasswordReset** | `resetUrl`, `email`, `actorType` (`"customer"` \| `"user"`) | Reset link for customer or admin |
| **InviteUser** | `inviteUrl`, `email`, `storeName` | Admin team invitation |
| **Welcome** | `customerName?`, `shopUrl`, `accountUrl` | Post-registration welcome |
| **AdminOrderAlert** | `orderNumber`, `customerName`, `customerEmail`, `total`, `items`, `adminOrderUrl` | Admin new-order notification |
| **AbandonedCart** | `items`, `subtotal`, `recoveryUrl`, `currencyCode?` | Cart recovery prompt |

---

## Shared Components

### `_components/` (8 files — core email building blocks)

| File | Purpose |
|---|---|
| `body.tsx` | Email body wrapper with `bg-secondary`, font-body |
| `button.tsx` | CTA button with primary/secondary variants via `cx()` |
| `head.tsx` | `<Head>` with `color-scheme` meta |
| `header.tsx` | Logo + optional navigation |
| `footer.tsx` | Company info, social links, legal links |
| `tailwind.tsx` | `<Tailwind>` wrapper injecting theme config |
| `text.tsx` | `<Text>` with margin reset |
| `line-items.tsx` | Generic line item table (`LineItem` type) |

### `_commerce/` (4 files — ecommerce-specific)

| File | Purpose |
|---|---|
| `item-table.tsx` | Order line items table with 64px product thumbnails (`CommerceLineItem[]`) |
| `order-summary.tsx` | Cost breakdown: subtotal, shipping, discount, tax, total |
| `address-block.tsx` | Shipping/billing address display with label |
| `order-status-badge.tsx` | Visual status indicator (confirmed, shipped, delivered, canceled) |

---

## Theming

3-file system in `_theme/`:

### `colors.ts` — 62 primitive colors

- **Gray scale** (gray-25 to gray-950): TailwindUI default gray
- **Brand scale** (brand-25 to brand-950): TailwindUI indigo (`brand-600` = `#4f46e5`)
- **Status colors**: error (red), warning (amber), success (green) — unchanged from UntitledUI

### `theme-colors.ts` — semantic token mappings

`getThemeColors(theme: "light" | "dark")` returns 15+ semantic tokens:

| Category | Tokens |
|---|---|
| Background | `primary` (white), `secondary` (gray-50), `brand-solid`, `brand-secondary` |
| Text | `primary` (gray-900), `secondary` (gray-700), `tertiary` (gray-600), `brand` |
| Border | `primary`, `secondary` (gray-200), `brand` (brand-500) |
| Button | primary fg/bg/border, secondary fg/bg/border |

### `theme.ts` — Tailwind config assembly

`getThemeObject(theme)` combines semantic colors with:
- Spacing (px-based for email safety, 64 levels)
- Font family (Inter + system stack)
- Font sizes (xs–display-2xl with line heights)
- Border radius (xs–3xl + full)
- Box shadows, screens (xxs: 320px, xs: 600px)

Templates never reference raw hex values — only semantic tokens via Tailwind classes (`bg-primary`, `text-tertiary`, `border-secondary`).

---

## Brand Configuration

**File:** `_config/email-config.ts`

```typescript
interface EmailBrandConfig {
  companyName: string
  logoUrl: string
  logoAlt?: string
  supportEmail: string
  websiteUrl: string
  appUrl?: string
  address?: string
  copyrightYear?: number
  socialLinks?: { twitter?, facebook?, instagram?, linkedin?, github? }
  legalLinks?: { terms?, privacy?, unsubscribe?, preferences?, cookies?, contact? }
  navLinks?: Array<{ label: string; href: string }>
}
```

**`getEmailConfig(overrides?)`** deep-merges `socialLinks` and `legalLinks` over defaults. Every template calls this at render time:

```typescript
const config = getEmailConfig(brandConfig);
```

Rebranding requires editing `email-config.ts` only — zero template files touched.

---

## Subscribers

9 email-related subscribers in `backend/src/subscribers/`:

| Subscriber | Event(s) | Workflow |
|---|---|---|
| `order-placed.ts` | `order.placed` | `sendOrderConfirmationWorkflow` |
| `customer-created.ts` | `customer.created` | `sendWelcomeEmailWorkflow` |
| `password-reset.ts` | `auth.password_reset` | `sendPasswordResetEmailWorkflow` |
| `shipment-created.ts` | `shipment.created` | `sendShippingConfirmationWorkflow` |
| `payment-refunded.ts` | `payment.refunded` | `sendRefundConfirmationWorkflow` |
| `order-canceled.ts` | `order.canceled` | `sendOrderCanceledWorkflow` |
| `admin-order-alert.ts` | `order.placed` | `sendAdminOrderAlertWorkflow` |
| `invite-created.ts` | `invite.created`, `invite.resent` | `sendInviteEmailWorkflow` |

**Shared helper:** `_helpers/resolve-urls.ts` provides `resolveStorefrontUrl()` and `resolveAdminUrl(container)` — handles trailing slash normalization and fallback defaults.

**Key patterns:**
- Subscribers are thin — they extract IDs from event data and call a workflow
- `admin-order-alert.ts` is a dual subscriber on the same `order.placed` event as `order-placed.ts`
- `invite-created.ts` subscribes to two events via array config
- PII (raw emails) is masked in log messages
- Fail-fast guards skip sending when `STOREFRONT_URL` or `admin.backendUrl` is not configured

---

## Workflows

10 notification workflows in `backend/src/workflows/notifications/`:

| Workflow | Steps |
|---|---|
| `send-order-confirmation` | `useQueryGraphStep` → `formatOrderForEmailStep` → `sendNotificationsStep` |
| `send-shipping-confirmation` | `useQueryGraphStep` → `formatOrderForEmailStep` → `sendNotificationsStep` |
| `send-order-canceled` | `useQueryGraphStep` → transform (refund calc) → `formatOrderForEmailStep` → `sendNotificationsStep` |
| `send-refund-confirmation` | `useQueryGraphStep` → `formatRefundForEmailStep` → transform → `sendNotificationsStep` |
| `send-welcome-email` | `useQueryGraphStep` → transform → `sendNotificationsStep` |
| `send-password-reset-email` | transform (URL generation) → `sendNotificationsStep` |
| `send-invite-email` | `retrieveInviteStep` → transform → `sendNotificationsStep` |
| `send-admin-order-alert` | `useQueryGraphStep` → transform (inline formatting) → `sendNotificationsStep` |
| `send-abandoned-cart-email` | `useQueryGraphStep` → transform → `generateCartRecoveryTokenStep` → `formatCartForEmailStep` → `sendNotificationsStep` → `updateCartsStep` |

**Common pattern:** Query entity → format for email → build notification object (template ID + data + metadata) → `sendNotificationsStep`.

All workflows use `sendNotificationsStep` from `@medusajs/medusa/core-flows` which routes to the Resend provider via the `"email"` channel.

---

## Format Steps

4 files in `backend/src/workflows/steps/` handle Medusa-to-email data transformation:

### `format-order-for-email.ts`

Shared across order confirmation, shipping confirmation, and order canceled workflows. Converts a Medusa order object into `FormattedOrderEmailData` — handles `itemSubtotal`/`itemTotal` fallback logic, currency formatting via `Intl.NumberFormat`.

### `format-refund-for-email.ts`

Extracts the latest refund from a payment object, resolves the parent order via `payment_collection?.order` or `payment_collections[0]?.order`, and formats into `FormattedRefundEmailData`. Gracefully handles orphan payments (no order link).

### `format-cart-for-email.ts`

Maps cart items and formats the subtotal for abandoned cart emails. Receives the recovery URL from the preceding `generateCartRecoveryTokenStep`.

### `_format-helpers.ts`

4 pure utility functions:
- `createCurrencyFormatter(currencyCode)` → `Intl.NumberFormat` instance
- `formatItem(item, formatMoney)` → `CommerceLineItem` shape
- `formatAddress(raw)` → `Address` (assembles `name` from `first_name`/`last_name`)
- `formatOrderDate(createdAt)` → human-readable date string (e.g., "March 14, 2026")

**Design decision:** All money values are pre-formatted as strings (e.g., `"$148.00"`) by format steps. Templates never do currency formatting — they stay dumb and testable.

---

## Scheduled Jobs

### Abandoned Cart Job

**File:** `backend/src/jobs/send-abandoned-cart-emails.ts`

**Schedule:** `*/15 * * * *` (every 15 minutes)

**Eligibility criteria:**
- `completed_at` is null (cart not checked out)
- `updated_at` between 1 hour and 48 hours ago
- `email` is present on the cart
- At least one line item
- `metadata.abandoned_cart_notified` is not set

**Process:**
1. Query eligible carts in batches of 100
2. For each cart, execute `sendAbandonedCartEmailWorkflow`
3. Workflow marks cart with `metadata.abandoned_cart_notified` = ISO timestamp (prevents re-sending)
4. Errors per-cart are caught and logged — one failure doesn't stop the batch
5. Logs total sent/error counts with duration

---

## Cart Recovery

### Token Generation (backend)

**File:** `backend/src/workflows/steps/generate-cart-recovery-token.ts`

```
HMAC-SHA256(cart_id, CART_RECOVERY_SECRET) → hex token
```

**Recovery URL format:** `${STOREFRONT_URL}/cart/recover/${cart_id}?token=${hexToken}`

### Verification (storefront)

**File:** `storefront/app/cart/recover/[id]/route.ts`

1. Recompute HMAC from the cart ID and `CART_RECOVERY_SECRET`
2. **Timing-safe comparison** via `timingSafeEqual()` (prevents timing attacks)
3. Validate cart exists and `completed_at` is null
4. Set cart session via `setCartId(id)`
5. Redirect to homepage

Returns 404 if secret is missing, token is invalid, or cart doesn't exist.

---

## Environment Variables

### Required (for email to function)

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key. If missing, entire Resend module is skipped. |
| `CART_RECOVERY_SECRET` | HMAC secret for abandoned cart recovery tokens |

### Optional

| Variable | Default | Purpose |
|---|---|---|
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | Sender email address |
| `STOREFRONT_URL` | `http://localhost:3000` | Base URL for customer-facing links |
| `ADMIN_ORDER_EMAILS` | (none) | Comma-separated admin emails for order alerts |

Backend URL for admin links (`MEDUSA_BACKEND_URL`) is resolved via `configModule.admin.backendUrl`.

---

## Directory Structure

```
backend/src/modules/resend/
├── index.ts                              # Module provider export
├── service.ts                            # ResendNotificationProviderService
└── templates/
    ├── template-registry.ts              # EmailTemplates enum + type
    ├── types.ts                          # BaseTemplateProps, CommerceLineItem, Address
    ├── order-confirmation.tsx            # 9 email templates
    ├── shipping-confirmation.tsx
    ├── order-canceled.tsx
    ├── refund-confirmation.tsx
    ├── password-reset.tsx
    ├── invite-user.tsx
    ├── welcome.tsx
    ├── admin-order-alert.tsx
    ├── abandoned-cart.tsx
    ├── _components/                      # 8 shared email components
    │   ├── body.tsx, button.tsx, footer.tsx, head.tsx
    │   ├── header.tsx, tailwind.tsx, text.tsx, line-items.tsx
    ├── _commerce/                        # 4 ecommerce-specific components
    │   ├── item-table.tsx, order-summary.tsx
    │   ├── address-block.tsx, order-status-badge.tsx
    ├── _config/
    │   └── email-config.ts               # EmailBrandConfig, defaults, getEmailConfig()
    ├── _theme/
    │   ├── colors.ts                     # 62 primitive colors
    │   ├── theme-colors.ts               # Semantic token mappings
    │   └── theme.ts                      # Full Tailwind config assembly
    └── utils/
        └── cx.ts                         # Class name concatenation utility

backend/src/subscribers/
├── order-placed.ts                       # order.placed → sendOrderConfirmationWorkflow
├── customer-created.ts                   # customer.created → sendWelcomeEmailWorkflow
├── password-reset.ts                     # auth.password_reset → sendPasswordResetEmailWorkflow
├── shipment-created.ts                   # shipment.created → sendShippingConfirmationWorkflow
├── payment-refunded.ts                   # payment.refunded → sendRefundConfirmationWorkflow
├── order-canceled.ts                     # order.canceled → sendOrderCanceledWorkflow
├── admin-order-alert.ts                  # order.placed → sendAdminOrderAlertWorkflow
├── invite-created.ts                     # invite.created|invite.resent → sendInviteEmailWorkflow
└── _helpers/
    └── resolve-urls.ts                   # URL resolution utilities

backend/src/workflows/notifications/
├── send-order-confirmation.ts
├── send-shipping-confirmation.ts
├── send-order-canceled.ts
├── send-refund-confirmation.ts
├── send-welcome-email.ts
├── send-password-reset-email.ts
├── send-invite-email.ts
├── send-admin-order-alert.ts
├── send-abandoned-cart-email.ts
└── _format-helpers.ts                    # Pure formatting utilities

backend/src/workflows/steps/
├── format-order-for-email.ts
├── format-refund-for-email.ts
├── format-cart-for-email.ts
└── generate-cart-recovery-token.ts

backend/src/jobs/
└── send-abandoned-cart-emails.ts         # */15 * * * *

storefront/app/cart/recover/[id]/
└── route.ts                              # HMAC verification + cart session restore
```

---

## Design Decisions

| Decision | Rationale |
|---|---|
| **Pre-formatted money strings** | Templates stay dumb and testable. Format steps own all `Intl.NumberFormat` logic — templates just render strings. |
| **Template type guards** | Runtime validation at the provider boundary prevents render crashes from malformed notification data. Graceful degradation: log + skip, never throw. |
| **Subscriber → workflow indirection** | Subscribers are thin event handlers. All business logic (data fetching, formatting, conditional sending) lives in workflows where it's testable and composable. |
| **No inline styles** | All styling via Tailwind classes through semantic tokens. Exception: `<Logo>` wordmark fallback in header/footer uses inline style for color outside `<Tailwind>` wrapper context. |
| **Table-based layout** | Email clients (especially Outlook, which uses Word as its renderer) don't support flexbox or CSS grid. `<Row>`/`<Column>` from react-email for all layout. |
| **HMAC cart recovery** | Recovery URLs contain a cart ID + HMAC signature — not raw cart IDs. Timing-safe verification on the storefront prevents token guessing and timing attacks. |
| **Conditional provider registration** | No `RESEND_API_KEY` → no Resend module loaded. Development works without email configured; no errors from missing API key. |
| **Semantic color tokens (15+)** | Templates reference `bg-primary`, `text-tertiary`, never raw hex. Rebranding only requires editing `colors.ts` and `theme-colors.ts`. |
| **Shared format helpers** | `_format-helpers.ts` contains pure functions reused across all format steps. Formatting logic is tested once, not duplicated per workflow. |

---

## Adding a New Email

1. **Create template** in `backend/src/modules/resend/templates/<name>.tsx`
   - Extend `BaseTemplateProps` for props interface
   - Export a `isValid<Name>Data()` type guard
   - Use shared `_components/` and `_commerce/` components
   - Add `PreviewProps` for the react-email dev server

2. **Register** in `service.ts` template registry with component, validator, and default subject

3. **Create format step** (if complex data) in `backend/src/workflows/steps/format-<name>-for-email.ts`

4. **Create workflow** in `backend/src/workflows/notifications/send-<name>.ts`
   - Query entity via `useQueryGraphStep`
   - Transform/format data
   - Call `sendNotificationsStep` with template ID and data

5. **Create subscriber** in `backend/src/subscribers/<event-name>.ts`
   - Subscribe to Medusa event
   - Extract IDs from event data
   - Execute the workflow

6. **Test** via `bun run dev:emails` (react-email preview on port 3003) and trigger the Medusa event
