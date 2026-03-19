# CrowCommerce: Email & Notification Implementation Plan v2

> **Note:** Directory structure and component architecture superseded by [`docs/email-template-architecture.md`](./email-template-architecture.md). This plan remains authoritative for Medusa integration (subscribers, workflows, scheduled jobs, event mapping, priority tiers).

## Audit Summary: What Changed From v1

The original plan covered ~40% of what a production-ready premium Medusa v2 storefront needs. A competitive audit against Shopify's 30+ built-in notification templates and a deep dive into Medusa v2's event system revealed **7 essential emails missing for launch** and **15+ additional notifications** across premium and differentiator tiers.

Medusa v2 ships with zero pre-built email templates — every notification must be custom-built. The event system (`{module}.{entity}.{action}`) provides the hooks, but the templates, subscribers, and workflows are entirely your responsibility.

### What Was Already Planned (✅ Kept)

- Resend integration (provider setup)
- Transactional templates (order confirmation, shipping, password reset)
- Invoice generator (PDF generation + email attachment)
- Quote management (B2B wholesale workflow)
- Abandoned cart recovery (scheduled job)
- Commerce automation (restock notifications)

### What Was Missing (🆕 Added in v2)

**Launch-blocking additions:**

- Customer welcome email (`customer.created`)
- Order canceled notification (`order.canceled`)
- Refund confirmation (custom event on refund processing)
- Payment failure alert (payment webhook / Stripe event)
- Admin: new order alert (dual subscriber on `order.placed`)
- Admin user invite (`invite.created`, `invite.resent`)
- Account email verification (custom workflow)

**Premium tier additions (new Stack 6):**

- Return request confirmation (`order.return_requested`)
- Return approved / declined (custom workflow events)
- Gift card delivery email (custom event on gift card purchase)
- Admin: low stock / out of stock alert (`inventory.inventory-level.updated`)
- Admin: daily/weekly sales digest (scheduled job)
- Review / feedback request (scheduled job, 7–14 days post-delivery)

**Deferred / future consideration:**

- Shipping status updates (requires carrier integration webhooks — out of scope for template MVP)
- Price drop alerts (requires wishlist module — not built into Medusa v2)
- Browse abandonment (requires frontend event tracking infrastructure)
- Win-back / re-engagement emails (scheduled job, 90+ day inactive)
- Loyalty / rewards notifications (requires custom module)
- Marketing double opt-in (GDPR compliance — implement when adding newsletter)

### Structural Issues Fixed From v1

1. **Monolithic scope → phased stacks.** The original prompt asked Claude Code to do everything in one session. Now broken into 7 Graphite stacks with 18 focused PRs.
2. **Missing dependency order → explicit sequencing.** Resend module → shared components → templates → subscribers → scheduled jobs. Each PR declares its dependencies.
3. **Unclear template strategy → concrete design tokens.** "TailwindUI themed" is now defined as specific values: Inter font stack, indigo-600 primary, 4px spacing scale, TailwindUI component defaults for radii and shadows.
4. **Commerce automation too vague → specific features.** Broken into: restock alerts (Stack 6), admin low-stock warnings (Stack 6), and review requests (Stack 6). Each has its own PR.
5. **Quote management missing notifications.** The Medusa guide covers the backend workflow but doesn't include email templates. Added explicit PR for quote lifecycle emails.

---

## Medusa v2 Event Reference: Notification-Relevant Events

Every notification hooks into Medusa's event system. Here are the events you'll subscribe to, grouped by domain:

**Orders:** `order.placed`, `order.updated`, `order.canceled`, `order.completed`, `order.fulfillment_created`, `order.shipment_created`, `order.return_requested`

**Customers:** `customer.created`, `customer.updated`

**Cart:** `cart.created`, `cart.updated` (used by abandoned cart scheduled job for filtering, not direct subscribers)

**Auth:** `auth.password_reset`

**Users/Admin:** `invite.created`, `invite.resent`, `user.created`

**Inventory:** `inventory.inventory-level.updated`

**Custom events you'll emit:** `gift-card.delivered`, `quote.sent`, `quote.accepted`, `quote.rejected`, `review.requested`, `refund.completed`

Custom events are emitted in workflows using `emitEventStep` from `@medusajs/medusa/core-flows`. Since v2.13.0, events support priority levels from CRITICAL (10) to LOWEST (2,097,152) — use this to ensure order confirmations always process before lower-priority notifications.

---

## Architecture: Event → Subscriber → Workflow → Notification → Resend

```
src/
├── modules/
│   └── resend/
│       ├── service.ts                  # Extends AbstractNotificationProviderService
│       ├── index.ts                    # ModuleProvider registration
│       └── templates/
│           ├── tokens.ts               # TailwindUI design tokens replacing UntitledUI values
│           ├── components/             # Restyled from UntitledUI shared components
│           │   ├── ...                 # Mirror UntitledUI's component structure
│           │   └── ...                 # Add commerce-specific components as needed
│           │                           # (order items table, order summary, address block)
│           ├── order-confirmation.tsx
│           ├── shipping-confirmation.tsx
│           ├── order-canceled.tsx
│           ├── refund-confirmation.tsx
│           ├── password-reset.tsx
│           ├── invite-user.tsx
│           ├── welcome.tsx
│           ├── abandoned-cart.tsx
│           ├── invoice-ready.tsx
│           ├── payment-failed.tsx
│           ├── return-requested.tsx
│           ├── return-status.tsx
│           ├── gift-card-delivery.tsx
│           ├── quote-request-received.tsx
│           ├── quote-sent.tsx
│           ├── quote-status.tsx
│           ├── review-request.tsx
│           ├── admin-new-order.tsx
│           ├── admin-low-stock.tsx
│           └── admin-daily-digest.tsx
├── subscribers/
│   ├── order-placed.ts
│   ├── order-shipped.ts
│   ├── order-canceled.ts
│   ├── refund-completed.ts
│   ├── password-reset.ts
│   ├── invite-created.ts
│   ├── customer-created.ts
│   ├── payment-failed.ts
│   ├── return-requested.ts
│   ├── return-status-changed.ts
│   ├── gift-card-purchased.ts
│   ├── quote-lifecycle.ts
│   ├── admin-new-order.ts
│   └── inventory-low-stock.ts
├── workflows/
│   └── notifications/
│       ├── send-order-confirmation.ts
│       ├── send-return-confirmation.ts
│       └── send-gift-card-delivery.ts
└── jobs/
    ├── abandoned-cart.ts
    ├── review-request.ts
    └── admin-daily-digest.ts
```

**Key architectural decisions:**

- Follow UntitledUI's react-email component usage and styling approach — don't introduce components or patterns they don't use. The Session 1A brainstorm will audit exactly which react-email components and patterns UntitledUI relies on.
- No flexbox, CSS grid, or box-shadow in email templates — Outlook uses Word as its rendering engine. Follow whatever layout approach UntitledUI uses for table-based layouts.
- One notification provider per channel in Medusa v2. Self-hosted = no conflict. If deploying to Medusa Cloud with their built-in email, you can't also use custom Resend on the `email` channel.
- Install `@react-email/render` explicitly alongside `resend` — the Medusa docs initially omitted this dependency.
- Time-based notifications (abandoned cart, review requests, admin digests) use scheduled jobs in `src/jobs/`, not event subscribers.

---

## Implementation Plan: 7 Graphite Stacks × Obra Superpowers Sessions

### Stack 1: Foundation — Resend Module + Base Email Components ✅ COMPLETED

> **Status:** All 4 PRs merged (2026-03-14). PRs #13–#16 in GitHub.
>
> **Implementation notes:**
> - Resend module provider with template resolver map pattern
> - UntitledUI-based shared email components restyled with TailwindUI tokens (using `@react-email/tailwind` instead of inline styles)
> - Order confirmation template + `send-order-confirmation` workflow (subscriber → workflow pattern)
> - `formatOrderForEmailStep` reusable step for future order-related emails
> - `preview:emails` script added (react-email dev server on port 3003)
> - Uses Medusa's `items.*` query pattern for computed order totals
> - `sendNotificationsStep` from `@medusajs/medusa/core-flows` for workflow-based notification sending

**Session 1A: Superpowers Brainstorm**

Goal: Audit the UntitledUI react-email templates, extract their component patterns, and design the restyled system architecture before writing any code.

```
Prompt for Obra Superpowers:

I'm building the email notification system for CrowCommerce (Next.js 16 + Medusa v2).

STEP 1: Analyze the UntitledUI react-email templates.
- Examine the UntitledUI email template source files
- Identify every react-email component they import and use
  (e.g., Html, Head, Body, Container, Section, Row, Column, Img,
  Text, Link, Button, Hr, Preview — whatever they actually use)
- Map out their component architecture: do they have shared layouts,
  reusable sub-components, helper utilities?
- Note their styling approach: inline styles, style objects, Tailwind
  component, or a mix?
- List which template types they include (e.g., transactional,
  notification, marketing, reset, welcome, etc.)

STEP 2: Design our email system that preserves the UntitledUI component
patterns and structure but swaps in TailwindUI design tokens.

Design constraints:
- Keep the same react-email components and patterns that UntitledUI uses.
  Don't introduce new components they don't use or remove ones they do.
- Replace UntitledUI's color palette, typography, spacing, and visual
  styling with TailwindUI values:
  - Primary: indigo-600 (#4F46E5)
  - Font: Inter
  - Gray scale, spacing, border radii from TailwindUI defaults
- Each template is a react-email component that accepts typed props
- Templates live in src/modules/resend/templates/
- Must handle both customer-facing and admin-facing emails

Please output:
- The full list of react-email components UntitledUI uses (so we
  know exactly what to install/import)
- Which UntitledUI shared components/layouts to keep vs adapt
- A tokens.ts mapping of TailwindUI values to replace UntitledUI's
  color/type/spacing system
- Directory structure for the notification module
- TypeScript interfaces for the templates we need to build

Do NOT implement yet. Output a design doc I can hand off to an
implementation session.
```

**PR 1: Resend Notification Module Provider**

Dependencies: None (first PR in the stack)

```
Prompt for Claude Code:

Implement the Resend notification module provider for Medusa v2.
Reference: https://docs.medusajs.com/resources/integrations/guides/resend

Files to create:
- src/modules/resend/service.ts
  - ResendNotificationService extending AbstractNotificationProviderService
  - send() method that resolves react-email templates by the `template` string param
  - Renders templates with @react-email/render before passing to resend.emails.send()
  - Proper error handling with structured logging
- src/modules/resend/index.ts — ModuleProvider registration

Files to update:
- medusa-config.ts — register provider for the "email" channel
- .env.template — add RESEND_API_KEY, RESEND_FROM_EMAIL, STORE_NAME

Dependencies to install:
- resend
- @react-email/render
- @react-email/components

The template resolver should be a simple map: { "order-confirmation": OrderConfirmation, ... }
Start with an empty map — templates will be added in subsequent PRs.

Do NOT create any email templates yet.

Commit message: feat(notification): add Resend module provider
```

**PR 2: Design Tokens + Shared Email Components (UntitledUI Restyle)**

Dependencies: PR 1

```
Prompt for Claude Code:

Restyle the UntitledUI react-email templates for CrowCommerce.

Use the design from our brainstorm session: [paste Session 1A output here]

APPROACH:
- Start by reading the UntitledUI react-email template source files
- Identify every shared component, layout wrapper, and helper they use
- Keep their component structure, react-email imports, and patterns intact
- Replace ONLY the visual design tokens (colors, fonts, spacing, radii)
  with TailwindUI values

Files to create:

1. src/modules/resend/templates/tokens.ts
   Export a tokens object that maps TailwindUI values into whatever
   styling approach UntitledUI uses (inline style objects, Tailwind
   config, or constants — match their pattern):
   - colors.primary: "#4F46E5" (indigo-600)
   - colors.primaryDark: "#4338CA" (indigo-700)
   - colors.gray: full scale 50–900
   - colors.success/warning/error
   - fonts.sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
   - fontSize: sm(14)/base(16)/lg(18)/xl(20)/2xl(24)/3xl(30)
   - spacing: scale from 1(4px) to 16(64px)
   - borderRadius: sm(4)/md(6)/lg(8)/xl(12)

2. src/modules/resend/templates/components/
   Copy over and restyle UntitledUI's shared components. Keep the same
   component names, props interfaces, and react-email component usage
   they already have. Only change the visual tokens to TailwindUI values.

   At minimum we need these for our email templates (create them if
   UntitledUI doesn't have exact equivalents, but model them after
   the closest UntitledUI component):
   - A base layout wrapper (header with logo, footer with store info)
   - A CTA button component
   - An order line items table (for order-related emails)
   - An order totals summary block
   - A formatted address block
   - A divider/separator

   If UntitledUI has additional shared components beyond these, bring
   them over too — they'll likely be useful for later templates.

3. Add "preview:emails": "email dev --dir ./src/modules/resend/templates"
   to backend package.json for the react-email dev server.

IMPORTANT: Do not introduce react-email components that UntitledUI
doesn't use. Follow their lead on which components to import. The goal
is a TailwindUI-skinned version of UntitledUI's proven email patterns,
not a from-scratch component library.

Commit message: feat(email): add TailwindUI-themed email components based on UntitledUI
```

**PR 3: Order Confirmation Template + Subscriber**

Dependencies: PR 2

```
Prompt for Claude Code:

Implement order confirmation email for CrowCommerce.

1. src/modules/resend/templates/order-confirmation.tsx
   Props interface:
   - orderNumber: string
   - orderDate: string
   - items: Array<{ name, variant?, quantity, unitPrice, total, imageUrl? }>
   - subtotal, shipping, tax, discount?, total: string (formatted)
   - currency: string
   - shippingAddress: address object
   - orderStatusUrl: string

   Layout:
   - "Order Confirmed" heading with checkmark
   - "Thank you for your order" subheading
   - Order number + date
   - Order line items (reuse the shared line items component from PR 2)
   - Order totals summary (reuse the shared totals component from PR 2)
   - Shipping address block
   - "View Order" CTA button linking to orderStatusUrl

2. src/workflows/notifications/send-order-confirmation.ts
   - useQueryGraphStep: fetch order with items, shipping_address, payment
   - Format currency amounts
   - Build orderStatusUrl: STOREFRONT_URL/account/orders/ORDER_ID
   - sendNotificationsStep: channel "email", template "order-confirmation"

3. src/subscribers/order-placed.ts
   - Subscribe to "order.placed"
   - Execute send-order-confirmation workflow

4. Wire "order-confirmation" into the Resend service template resolver map.

Follow the pattern from: https://docs.medusajs.com/resources/integrations/guides/resend

Commit message: feat(email): add order confirmation template and subscriber
```

---

### Stack 2: Core Auth & Admin Emails ✅ COMPLETED

> **Status:** PR #17 merged (2026-03-15). Single PR with 3 templates + 3 subscribers.
>
> **Implementation notes:**
> - Subscriber-only pattern (no workflows) — simpler than Stack 1 since no complex data fetching needed
> - Shared `_helpers/resolve-urls.ts` extracted for DRY URL resolution across subscribers
> - Fail-fast guards: subscribers skip sending when `STOREFRONT_URL` or `admin.backendUrl` is not configured (prevents broken links)
> - Password reset: `entity_id` IS the email (renamed from `email` after Medusa v2.0.7), token expires in 15 minutes
> - Admin invite: subscribes to both `invite.created` and `invite.resent` via array config, always fetches fresh token
> - Customer welcome: fires for both self-service signups and admin-created customers, degrades greeting to "Hi there," when no name
> - PII masking: raw emails removed from log messages
> - Trailing slash normalization on URL bases
> - Email case-sensitivity bug found and fixed: added `.toLowerCase()` to login, signup, and checkout email handling
> - `storeName` resolved from `EmailBrandConfig.companyName` (no extra service call)
>
> **Spec:** `docs/superpowers/specs/2026-03-15-email-stack2-auth-admin-design.md`
> **Plan:** `docs/superpowers/plans/2026-03-15-email-stack2-auth-admin.md`

**Session 2: Superpowers Brainstorm (quick)**

Review Stack 1 implementation, confirm the template → subscriber → workflow pattern works, then proceed. No heavy design needed — these follow established patterns.

```
Prompt for Obra Superpowers:

Stack 1 of CrowCommerce email system is complete. Review the patterns in:
- src/modules/resend/service.ts (template resolver)
- src/subscribers/order-placed.ts (subscriber pattern)
- src/workflows/notifications/send-order-confirmation.ts (workflow pattern)

I need to implement 3 more transactional emails following the same patterns.
For each, confirm the Medusa v2 event name, the data available in the event
payload, and any gotchas:

1. Password reset (auth.password_reset) — needs to handle both customer
   and admin actor types with different reset URLs
2. Admin user invite (invite.created, invite.resent) — needs invite
   token for accept URL
3. Customer welcome (customer.created) — simple template, browse CTA

Are there any differences in how these events work compared to order.placed
that I should account for? Any edge cases?
```

**PR 4: Password Reset Email**

Dependencies: PR 2 (shared components)

```
Prompt for Claude Code:

Implement password reset email for CrowCommerce.

Follow the same pattern as src/subscribers/order-placed.ts and
src/modules/resend/templates/order-confirmation.tsx.

1. src/modules/resend/templates/password-reset.tsx
   Props: resetUrl, email, actorType ("customer" | "user")
   Layout:
   - "Reset Your Password" heading
   - Brief explanation text
   - "Reset Password" CTA button
   - "This link expires in 1 hour" warning
   - "If you didn't request this, you can safely ignore this email"
   - Different copy for admin vs customer actorType

2. src/subscribers/password-reset.ts
   - Subscribe to "auth.password_reset"
   - Build reset URL based on actor_type:
     - customer → STOREFRONT_URL/reset-password?token=TOKEN&email=EMAIL
     - user → BACKEND_URL/app/reset-password?token=TOKEN&email=EMAIL
   - Send notification with "password-reset" template
   - Reference: https://docs.medusajs.com/resources/commerce-modules/auth/reset-password

3. Wire template into Resend service resolver.

Commit message: feat(email): add password reset template and subscriber
```

**PR 5: Admin Invite Email**

Dependencies: PR 2

```
Prompt for Claude Code:

Implement admin user invite email for CrowCommerce.

1. src/modules/resend/templates/invite-user.tsx
   Props: inviteUrl, email, storeName
   Layout:
   - "You've been invited" heading
   - "You've been invited to join {storeName}" body text
   - "Accept Invite" CTA button
   - "This invitation will expire in 7 days"

2. src/subscribers/invite-created.ts
   - Subscribe to BOTH "invite.created" and "invite.resent"
   - Fetch invite details (email, token) from event data
   - Build invite URL: BACKEND_URL/app/invite?token=TOKEN
   - Send notification with "invite-user" template
   - Reference: Medusa user module docs on invite subscribers

3. Wire template into Resend service resolver.

Commit message: feat(email): add admin invite template and subscriber
```

**PR 6: Customer Welcome Email**

Dependencies: PR 2

```
Prompt for Claude Code:

Implement customer welcome email for CrowCommerce.

1. src/modules/resend/templates/welcome.tsx
   Props: customerName (string | null), shopUrl, accountUrl
   Layout:
   - "Welcome to {storeName}" heading
   - Warm welcome message (personalized with name if available)
   - Brief value propositions (2-3 bullets about the store)
   - "Start Shopping" primary CTA → shopUrl
   - "View Your Account" secondary CTA → accountUrl

2. src/subscribers/customer-created.ts
   - Subscribe to "customer.created"
   - Fetch customer name from event data
   - Send notification with "welcome" template

3. Wire template into Resend service resolver.

Commit message: feat(email): add customer welcome template and subscriber
```

---

### Stack 3: Order Lifecycle Emails ✅ COMPLETED

> **Status:** PR #19 merged (2026-03-16). Shipping confirmation, order canceled, refund confirmation, and admin new order alert templates + subscribers/workflows.
>
> **Implementation notes:**
> - Shared `formatOrderForEmailStep` reused across all order lifecycle emails
> - `formatRefundForEmailStep` added for refund-specific formatting
> - Shipping confirmation includes tracking number/carrier/URL (optional)
> - Order canceled shows refund status messaging
> - Admin new order alert sends to `ADMIN_ORDER_EMAILS` env var (comma-separated list)
> - Payment failed template deferred — requires Stripe webhook handler not yet built
>
> **Cross-cutting enhancement (PR #21, 2026-03-18):** Added 64px product thumbnail images to all email templates via `ItemTable` component. `item.thumbnail` data was already flowing through `formatOrderForEmailStep`; the component now renders it.

**Session 3: Superpowers Brainstorm (quick)**

```
Prompt for Obra Superpowers:

I need to implement the remaining order lifecycle emails for CrowCommerce.
These all follow the established subscriber → workflow → template pattern.

For each, help me understand:
1. The exact Medusa v2 event and what data is available in the payload
2. Any data I need to fetch via useQueryGraphStep that isn't in the payload

Emails:
- Shipping confirmation (order.fulfillment_created) — need tracking info
- Order canceled (order.canceled) — need refund status
- Refund confirmation — what event fires when a refund is processed?
- Payment failure — how does Medusa v2 surface Stripe payment failures?
- Admin new order alert — dual subscriber on order.placed sending to admin email

Flag any events that DON'T exist yet and would need custom event emission.
```

**PR 7: Shipping Confirmation Email**

Dependencies: PR 2

```
Prompt for Claude Code:

Implement shipping confirmation email for CrowCommerce.

1. src/modules/resend/templates/shipping-confirmation.tsx
   Props:
   - orderNumber, items (shipped items subset)
   - trackingNumber, carrier, trackingUrl (all optional — not all
     fulfillments have tracking)
   - shippingAddress

   Layout:
   - "Your Order Has Shipped" heading with package icon
   - Order number reference
   - Tracking info block (if available): carrier name, tracking number,
     "Track Package" CTA button
   - "No tracking available" fallback message if no tracking info
   - List of shipped items (reuse line items component from PR 2)
   - Shipping address

2. src/subscribers/order-shipped.ts
   - Subscribe to "order.fulfillment_created"
   - Fetch fulfillment details including tracking_links
   - Fetch related order items
   - Send notification with "shipping-confirmation" template

3. Wire template into resolver.

Commit message: feat(email): add shipping confirmation template and subscriber
```

**PR 8: Order Canceled + Refund Confirmation + Payment Failed**

Dependencies: PR 2

```
Prompt for Claude Code:

Implement three order-related notification emails for CrowCommerce.

All follow the established patterns from prior PRs. Reuse shared components.

1. ORDER CANCELED
   - Template: src/modules/resend/templates/order-canceled.tsx
     Props: orderNumber, items, cancelReason (optional), refundMessage
     Layout: "Order Canceled" heading, order number, item list,
     refund status message ("A refund will be processed..." or
     "No charge was made"), "Contact Support" CTA
   - Subscriber: src/subscribers/order-canceled.ts
     Event: "order.canceled"
     Fetch: order with items, check payment status for refund messaging

2. REFUND CONFIRMATION
   - Template: src/modules/resend/templates/refund-confirmation.tsx
     Props: orderNumber, refundAmount, currency, refundReason (optional),
     paymentMethod (last 4 digits if available), estimatedDays
     Layout: "Refund Processed" heading, amount + method, timeline
     estimate, order reference, "View Order" CTA
   - Subscriber: src/subscribers/refund-completed.ts
     Determine the correct event for refund completion in Medusa v2.
     If no built-in event exists, document where to emit a custom
     "refund.completed" event in the refund workflow.

3. PAYMENT FAILED
   - Template: src/modules/resend/templates/payment-failed.tsx
     Props: orderNumber (if exists), amount, currency, failureReason,
     retryUrl
     Layout: "Payment Issue" heading (not "failed" — softer language),
     explanation, "Update Payment" CTA, "Contact Support" secondary CTA
   - Subscriber: src/subscribers/payment-failed.ts
     Hook into Stripe webhook events for payment_intent.payment_failed
     or the Medusa equivalent. If Medusa doesn't surface this event
     natively, document the webhook handler needed.

Wire all three templates into the resolver.

Commit messages (one per template+subscriber pair):
- feat(email): add order canceled template and subscriber
- feat(email): add refund confirmation template and subscriber
- feat(email): add payment failed template and subscriber
```

**PR 9: Admin New Order Alert**

Dependencies: PR 2

```
Prompt for Claude Code:

Implement admin new order notification for CrowCommerce.

This is a dual subscriber on the same "order.placed" event — the
customer gets order-confirmation (PR 3), the admin gets this alert.

1. src/modules/resend/templates/admin-new-order.tsx
   Props: orderNumber, customerName, customerEmail, total, currency,
   itemCount, orderAdminUrl
   Layout:
   - Simple, dense format (admins want data, not marketing polish)
   - "New Order #{orderNumber}" subject line
   - Customer info, order total, item count
   - "View in Admin" CTA → BACKEND_URL/app/orders/ORDER_ID
   - Timestamp

2. src/subscribers/admin-new-order.ts
   - Subscribe to "order.placed"
   - Fetch order summary data
   - Send to ADMIN_EMAIL env var (or a configurable admin email list)
   - Template: "admin-new-order"

3. Wire template into resolver.
4. Add ADMIN_NOTIFICATION_EMAIL to .env.template

Commit message: feat(email): add admin new order alert
```

---

### Stack 4: Abandoned Cart Recovery ✅ COMPLETED

> **Status:** Merged (2026-03-18). Abandoned cart email template, scheduled job (every 15 min), HMAC-signed recovery links, storefront cart recovery route.
>
> **Implementation notes:**
> - Scheduled job runs every 15 minutes, queries carts with email + items that haven't been notified
> - HMAC token generation step for secure recovery URLs (not raw cart IDs)
> - Storefront `/cart/recovery` route verifies HMAC signature before restoring cart session
> - `formatCartForEmailStep` for cart-specific email formatting
> - Cart metadata `abandoned_cart_notified` timestamp prevents re-sending

**Session 4: Superpowers Brainstorm**

```
Prompt for Obra Superpowers:

Design the abandoned cart recovery system for CrowCommerce (Medusa v2).
Reference: https://docs.medusajs.com/resources/how-to-tutorials/tutorials/abandoned-cart

Design decisions I need help with:
- What qualifies as "abandoned"? (time threshold, must have email,
  items in cart, no completed order)
- Scheduled job frequency (how often to check)
- Single email vs drip sequence? (MVP = single email)
- How to track which carts have been emailed (metadata flag on cart)
- Cart recovery link strategy (deep link that restores cart session)
- How to query carts in Medusa v2 — what's the right Query Graph
  approach for finding abandoned carts?

For MVP: single abandoned cart email sent after 1 hour of inactivity
if the cart has items, an email, and no associated completed order.

Design the scheduled job logic, query approach, and template interface.
Do NOT implement yet.
```

**PR 10: Abandoned Cart Template + Scheduled Job**

Dependencies: PR 2 (shared components)

```
Prompt for Claude Code:

Implement abandoned cart recovery for CrowCommerce.
Reference: https://docs.medusajs.com/resources/how-to-tutorials/tutorials/abandoned-cart

Use the design from our brainstorm session: [paste Session 4 output]

1. src/modules/resend/templates/abandoned-cart.tsx
   Props: customerName (optional), items array, cartTotal, currency,
   recoveryUrl, itemCount
   Layout:
   - "You left something behind" heading
   - Cart items preview (images, names, prices — reuse the line items
     component from PR 2)
   - Cart total
   - "Complete Your Order" primary CTA → recoveryUrl
   - "Need help? Contact us" secondary text

2. src/jobs/abandoned-cart.ts
   Scheduled job:
   - Runs every 15 minutes via cron expression
   - Queries carts where:
     - updated_at is between 1 hour and 48 hours ago
     - has email on the cart
     - has at least one line item
     - no completed_at
     - metadata.abandoned_cart_email_sent !== true
   - For each qualifying cart:
     - Send abandoned-cart notification
     - Update cart metadata: { abandoned_cart_email_sent: true }
   - Include error handling — don't let one failed send stop the batch
   - Log sent count for monitoring

3. Recovery URL: STOREFRONT_URL/cart?recovery=CART_ID
   (Frontend will need to handle restoring the cart — note this as a
   TODO for the storefront, out of scope for this PR)

4. Wire template into resolver.

Commit message: feat(email): add abandoned cart recovery job and template
```

---

### Stack 5: Invoice Generator

**Session 5: Superpowers Brainstorm**

```
Prompt for Obra Superpowers:

Design the invoice generation system for CrowCommerce (Medusa v2).
Reference: https://docs.medusajs.com/resources/how-to-tutorials/tutorials/invoice-generator

Key decisions I need help with:
- PDF generation approach: react-pdf vs puppeteer vs jsPDF
  (react-pdf preferred for consistency with react-email)
- Invoice number format: INV-{YEAR}-{AUTO_INCREMENT} (e.g., INV-2026-0001)
- Storage: use Medusa's File Module (S3 compatible)
- Trigger: generate on order.placed, attach to confirmation email
  OR generate on-demand when customer/admin requests it
- Data model: need an Invoice entity linking to order with invoice
  number, generated date, PDF file reference

Design the data model extension (Medusa v2 custom module), the PDF
template layout, and the generation workflow.
Do NOT implement yet.
```

**PR 11: Invoice Data Model + PDF Generation Workflow**

Dependencies: None (independent module, but benefits from Stack 1 being done for testing)

```
Prompt for Claude Code:

Implement invoice generation for CrowCommerce.
Reference: https://docs.medusajs.com/resources/how-to-tutorials/tutorials/invoice-generator

1. Invoice Module (custom Medusa v2 module):
   - src/modules/invoice/models/invoice.ts
     Fields: id, invoice_number (unique), order_id, file_id (reference
     to stored PDF), generated_at, display_number (formatted: INV-2026-0001)
   - src/modules/invoice/service.ts — InvoiceModuleService
   - Auto-increment logic for invoice numbers

2. PDF Generation:
   - src/modules/invoice/templates/invoice-pdf.tsx
     Styled to match TailwindUI aesthetic:
     - Store logo and business info header
     - "INVOICE" title with invoice number + date
     - Bill-to / Ship-to addresses side by side
     - Line items table: product, qty, unit price, line total
     - Summary: subtotal, shipping, tax, discounts, grand total
     - Payment status and method
     - Footer with terms/notes

3. Workflow: src/workflows/generate-invoice.ts
   - Accept order_id
   - Fetch order with all related data via Query Graph
   - Generate invoice number
   - Render PDF
   - Upload to Medusa File Module
   - Create Invoice record linking order → file
   - Return invoice ID and download URL

4. API Route: src/api/store/orders/[id]/invoice/route.ts
   - GET: download invoice PDF for an order (customer-facing)
   - Validate customer owns the order

Commit messages:
- feat(invoice): add invoice data model and module
- feat(invoice): add PDF generation template and workflow
- feat(invoice): add invoice download API route
```

**PR 12: Invoice Email Integration**

Dependencies: PR 11, PR 3 (order confirmation)

```
Prompt for Claude Code:

Integrate invoice generation with the order confirmation email in CrowCommerce.

Two options — implement whichever is cleaner given Resend's API:

Option A (preferred): Add invoice PDF as email attachment
- Update send-order-confirmation workflow to:
  1. Generate invoice (call generate-invoice workflow)
  2. Get PDF buffer from File Module
  3. Pass as attachment to Resend send() call
- Resend supports attachments via the `attachments` option with
  { filename, content (base64) }

Option B (fallback): Send separate "invoice ready" email
- src/modules/resend/templates/invoice-ready.tsx
  Props: orderNumber, invoiceNumber, downloadUrl
  Layout: "Your Invoice is Ready" heading, invoice details,
  "Download Invoice" CTA

Also:
- Add "Download Invoice" link to the storefront order detail page
  (this may just be a TODO for the frontend PR)

Commit message: feat(invoice): integrate invoice PDF with order confirmation email
```

---

### Stack 6: Returns, Gift Cards, Admin Alerts & Review Requests

This stack covers the "premium standard" features that separate a professional template from a basic one. These are the highest-value additions identified in the research audit.

**Session 6: Superpowers Brainstorm**

```
Prompt for Obra Superpowers:

I need to design four notification features for CrowCommerce that are
independent of each other but share the same email infrastructure
from Stacks 1–3.

For each feature, help me understand:
1. Which Medusa v2 events exist vs need custom emission
2. The workflow and data requirements
3. Template design considerations

Features:
A. Return flow emails (return request confirmation, return approved/declined)
   - What events does Medusa v2 emit for returns?
   - How does the return lifecycle work in v2?

B. Gift card delivery email
   - How are gift cards purchased and fulfilled in Medusa v2?
   - Is there a built-in event or do we need custom emission?

C. Admin alerts: low stock warnings
   - inventory.inventory-level.updated — how to detect "low" threshold?
   - Should this be a subscriber or a scheduled job?

D. Post-purchase review request
   - Scheduled job approach: query delivered orders 7-14 days old
   - How to know an order has been delivered? (fulfillment status)
   - How to avoid sending to customers who already reviewed?

Design all four. These will each become a separate PR.
```

**PR 13: Return Flow Emails**

Dependencies: PR 2 (shared components)

```
Prompt for Claude Code:

Implement return flow notification emails for CrowCommerce.

Returns are the highest-anxiety moment in ecommerce — clear communication
directly impacts repeat purchase rates.

1. RETURN REQUEST CONFIRMATION
   - Template: src/modules/resend/templates/return-requested.tsx
     Props: orderNumber, returnItems, returnReason, returnId
     Layout: "Return Request Received" heading, items being returned,
     next steps explanation, "View Return Status" CTA
   - Subscriber: src/subscribers/return-requested.ts
     Event: "order.return_requested" (verify this event exists in Medusa v2)
     Fetch return details and original order info

2. RETURN STATUS UPDATE (approved/declined)
   - Template: src/modules/resend/templates/return-status.tsx
     Props: orderNumber, returnStatus ("approved" | "declined"),
     returnItems, refundAmount?, declineReason?, returnInstructions?
     Layout:
     - Approved: "Return Approved" heading, refund amount,
       return shipping instructions, estimated refund timeline
     - Declined: "Return Update" heading (softer language),
       reason, "Contact Support" CTA
   - Subscriber: src/subscribers/return-status-changed.ts
     Determine the correct event for return approval/decline.
     If no built-in event, document where to emit custom events
     in the admin return workflow.

Wire both templates into the resolver.

Commit messages:
- feat(email): add return request confirmation template
- feat(email): add return status update template and subscriber
```

**PR 14: Gift Card Delivery Email**

Dependencies: PR 2

```
Prompt for Claude Code:

Implement gift card delivery email for CrowCommerce.

When a customer purchases a gift card, the recipient should receive an
email with the gift card code and value.

1. src/modules/resend/templates/gift-card-delivery.tsx
   Props: recipientName (optional), senderName (optional),
   giftCardCode, value, currency, personalMessage (optional),
   redeemUrl
   Layout:
   - Visually distinct from transactional emails — more "gift" feeling
   - "You've received a gift card" heading
   - Personal message from sender (if provided)
   - Gift card value prominently displayed
   - Gift card code in a styled box (easy to copy)
   - "Shop Now" CTA → redeemUrl
   - "From {senderName}" attribution if available

2. src/subscribers/gift-card-purchased.ts
   - Determine the correct trigger: is there a built-in Medusa v2 event
     for gift card creation/purchase, or do we need to emit a custom
     "gift-card.delivered" event in the gift card fulfillment workflow?
   - Fetch gift card details (code, value, recipient email)
   - Send notification

Wire template into resolver.

Commit message: feat(email): add gift card delivery template and subscriber
```

**PR 15: Admin Low Stock Alert**

Dependencies: PR 2

```
Prompt for Claude Code:

Implement admin low stock alert for CrowCommerce.

When inventory drops below a configurable threshold, notify the admin.

1. src/modules/resend/templates/admin-low-stock.tsx
   Props: products array of { name, variant, currentStock, threshold, sku },
   totalAlerts
   Layout:
   - Simple, scannable admin format
   - "Low Stock Alert" heading with warning icon
   - Table: product name, variant, current stock, threshold, SKU
   - "View Inventory" CTA → admin inventory page

2. src/subscribers/inventory-low-stock.ts
   - Subscribe to "inventory.inventory-level.updated"
   - On each update, check if the new quantity <= LOW_STOCK_THRESHOLD
     (env var, default: 10)
   - If below threshold, send notification to ADMIN_NOTIFICATION_EMAIL
   - Debounce: use metadata or a simple in-memory cache to avoid
     spamming the admin with alerts for the same product within 24 hours
   - Template: "admin-low-stock"

Wire template into resolver.
Add LOW_STOCK_THRESHOLD to .env.template (default: 10).

Commit message: feat(email): add admin low stock alert
```

**PR 16: Post-Purchase Review Request**

Dependencies: PR 2

```
Prompt for Claude Code:

Implement post-purchase review request emails for CrowCommerce.

A scheduled job that sends review requests 7 days after order fulfillment.

1. src/modules/resend/templates/review-request.tsx
   Props: customerName, orderNumber, items (name, imageUrl),
   reviewUrl
   Layout:
   - "How was your order?" heading
   - Brief personal ask for feedback
   - Product images from the order
   - "Leave a Review" primary CTA → reviewUrl
   - "We'd love to hear from you" soft copy
   - Keep it short — one CTA, no distractions

2. src/jobs/review-request.ts
   Scheduled job:
   - Runs daily at 10:00 AM store timezone
   - Query orders where:
     - Has at least one fulfillment
     - Fulfillment created_at is between 7 and 8 days ago (1-day window)
     - Order metadata.review_request_sent !== true
   - For each qualifying order:
     - Send review-request notification to customer email
     - Set order metadata: { review_request_sent: true }
   - Error handling: don't let one failure stop the batch

3. reviewUrl strategy: STOREFRONT_URL/account/orders/ORDER_ID#review
   (Frontend will need a review form — note as TODO)

Wire template into resolver.

Commit message: feat(email): add post-purchase review request job
```

---

### Stack 7: Quote Management

This stack is wholesale/B2B specific. Lower priority than Stacks 1–6 but relevant for the hemp/kratom store use case.

**Session 7: Superpowers Brainstorm**

```
Prompt for Obra Superpowers:

Design the quote management system for CrowCommerce (Medusa v2).
Reference: https://docs.medusajs.com/resources/examples/guides/quote-management

This is for the hemp/kratom wholesale use case — bulk orders where
pricing is negotiated.

Design:
- The full quote lifecycle: customer requests → admin reviews → admin
  sends quote with pricing → customer accepts or rejects
- Which stages need email notifications and to whom (customer vs admin)
- Data model for quotes
- Custom events to emit at each stage for email triggers
- Email templates needed (list with props)

Note: The Medusa guide covers the backend workflow but does NOT include
email templates. We need to add those ourselves.

Do NOT implement yet.
```

**PR 17: Quote Module + Backend Workflows**

Dependencies: None (independent module)

```
Prompt for Claude Code:

Implement the quote management backend for CrowCommerce.
Reference: https://docs.medusajs.com/resources/examples/guides/quote-management

Focus on the backend only — no email templates in this PR.

- Quote data model (custom Medusa v2 module)
- Quote lifecycle workflows (create, review, send, accept, reject, expire)
- API routes for customer and admin actions
- Emit custom events at each lifecycle stage:
  - "quote.requested" (customer submits)
  - "quote.sent" (admin sends pricing to customer)
  - "quote.accepted" (customer accepts)
  - "quote.rejected" (customer rejects)
  - "quote.expired" (scheduled expiry)

Follow the Medusa v2 example guide closely for the data model and
workflow patterns.

Commit messages:
- feat(quote): add quote data model and module
- feat(quote): add quote lifecycle workflows
- feat(quote): add quote API routes
```

**PR 18: Quote Email Templates + Subscribers**

Dependencies: PR 17, PR 2 (shared components)

```
Prompt for Claude Code:

Add email notifications for the quote lifecycle in CrowCommerce.

1. QUOTE REQUEST RECEIVED (to admin)
   - Template: src/modules/resend/templates/quote-request-received.tsx
     Props: customerName, customerEmail, requestedItems, notes, quoteAdminUrl
   - Subscriber: event "quote.requested" → send to ADMIN_NOTIFICATION_EMAIL

2. QUOTE SENT (to customer)
   - Template: src/modules/resend/templates/quote-sent.tsx
     Props: customerName, items with quoted prices, total, validUntil,
     acceptUrl, quoteNumber
   - Subscriber: event "quote.sent" → send to customer email

3. QUOTE ACCEPTED (to admin)
   - Template: src/modules/resend/templates/quote-status.tsx
     (reuse for both accepted and rejected)
     Props: quoteNumber, customerName, status, items, total, quoteAdminUrl
   - Subscriber: event "quote.accepted" → send to admin

4. QUOTE REJECTED (to admin)
   - Reuse quote-status.tsx template with status="rejected"
   - Subscriber: event "quote.rejected" → send to admin

5. QUOTE EXPIRED (to customer)
   - Simple notification: "Your quote has expired. Request a new one?"
   - Subscriber: event "quote.expired" → send to customer

Wire all templates into the resolver.

Commit messages (one per template+subscriber):
- feat(email): add quote request received admin notification
- feat(email): add quote sent customer notification
- feat(email): add quote status change notifications
- feat(email): add quote expired customer notification
```

---

## Session Workflow: Obra Superpowers + Claude Code

For each PR, follow this cycle:

```
1. SUPERPOWERS BRAINSTORM (fresh Obra session)
   ├─ Design the feature architecture
   ├─ Define interfaces, data flow, file structure
   ├─ Output: design doc or detailed implementation spec
   └─ Copy output directly as Claude Code implementation prompt

2. IMPLEMENT (fresh Claude Code session)
   ├─ Paste the brainstorm output as the prompt
   ├─ Reference prior PRs by file path for pattern consistency
   ├─ One template + one subscriber per commit
   └─ Conventional commit messages (feat/fix/refactor)

3. CODERABBIT REVIEW
   ├─ Push PR to GitHub via Graphite
   ├─ Let CodeRabbit catch issues
   └─ Fix findings in follow-up commits

4. CODE SIMPLIFIER PASS
   └─ Review for unnecessary complexity, dead code, over-abstraction

5. MANUAL TEST
   ├─ Use react-email preview server (email dev) for visual testing
   ├─ Use Medusa's Local Notification Provider for dev (logs to console)
   ├─ Test full event → subscriber → email flow with real Medusa actions
   └─ Verify email renders in Gmail, Apple Mail, Outlook (key clients)

6. SECURITY AUDIT (for PRs touching auth, payment, or PII)
   ├─ Run Codex with AGENTS.md review guidelines
   ├─ Verify no PII leakage in email templates
   ├─ Confirm reset tokens are single-use and expire
   ├─ Verify admin-only endpoints require admin auth
   └─ Check that customer can't access other customers' invoices/orders

7. E2E TEST (for critical flows)
   └─ Order placed → confirmation email sent → invoice generated
   └─ Password reset flow end-to-end
   └─ Abandoned cart job runs → email sent → recovery link works
```

### Tips for Obra Superpowers Sessions

- **Start each session by stating the PR scope explicitly.** "This session covers PR 10: Abandoned Cart. Do not implement anything from other stacks."
- **Reference prior PRs by file path.** "Follow the same subscriber pattern as `src/subscribers/order-placed.ts` from PR 3" is more effective than re-describing the pattern.
- **Brainstorm output = implementation prompt.** Copy the Superpowers design output directly into the Claude Code session. Don't summarize or rephrase — context loss causes drift.
- **One template + one subscriber per commit** keeps git history clean for Graphite review.
- **Start fresh Claude Code sessions for each stack.** Context from Stack 1 won't help in Stack 5 and just wastes the window.
- **If a session stalls or goes off-track,** kill it and start fresh rather than trying to course-correct. Cheaper than debugging a confused context.

---

## Priority Order

Ship incrementally. Each row is independently deployable once its dependencies are met.

| Priority | PR(s) | Feature | Status | Why |
|----------|-------|---------|--------|-----|
| P0 | 1–3 | Resend module + components + order confirmation | ✅ Done | Can't launch without order emails |
| P0 | 4 | Password reset | ✅ Done | Can't have accounts without recovery |
| P0 | 7 | Shipping confirmation | ✅ Done | Most-checked email after purchase |
| P1 | 5 | Admin invite | ✅ Done | Needed before onboarding store staff |
| P1 | 8 | Order canceled + refund + payment failed | ✅ Done (payment-failed deferred) | Customer trust, reduces support load |
| P1 | 9 | Admin new order alert | ✅ Done | Operations essential |
| P1 | 10 | Abandoned cart | ✅ Done | Direct revenue recovery (~5–10% of abandoned carts convert) |
| P2 | 6 | Customer welcome | ✅ Done | Brand polish, 3× engagement vs promo emails |
| P2 | 11–12 | Invoice generator | | Professional, may be legally required in some jurisdictions |
| P2 | 13 | Return flow emails | | High-anxiety moment, impacts repeat purchases |
| P3 | 14 | Gift card delivery | | Only needed if selling gift cards |
| P3 | 15 | Admin low stock alert | | Prevents stockouts |
| P3 | 16 | Review request | | Drives UGC and social proof |
| P4 | 17–18 | Quote management | | Wholesale-specific, can launch without |

---

## Template Naming Convention

These IDs are what subscribers pass to `notificationModuleService.createNotifications({ template: "..." })` and what the Resend service resolves to react-email components.

```
# Stack 1: Foundation ✅
order-confirmation          # ✅ implemented

# Stack 2: Auth & Admin ✅
password-reset              # ✅ implemented
invite-user                 # ✅ implemented
welcome                     # ✅ implemented

# Stack 3: Order Lifecycle ✅
shipping-confirmation       # ✅ implemented
order-canceled              # ✅ implemented
refund-confirmation         # ✅ implemented
payment-failed              # ⏳ deferred (needs Stripe webhook handler)
admin-new-order             # ✅ implemented (admin-order-alert)

# Stack 4: Recovery ✅
abandoned-cart              # ✅ implemented

# Stack 5: Invoicing
invoice-ready (if separate email, otherwise attached to order-confirmation)

# Stack 6: Premium
return-requested
return-status
gift-card-delivery
admin-low-stock
review-request

# Stack 7: Quotes
quote-request-received
quote-sent
quote-status (handles both accepted + rejected)
quote-expired
```

Total: **20 unique templates** across 7 stacks and 18 PRs.

---

## Known Gotchas & Implementation Notes

**react-email + Medusa v2:**
- Install `@react-email/render` explicitly — the Medusa docs initially omitted this and it caused runtime crashes (GitHub issue #13901).
- Use `pixelBasedPreset` in the `<Tailwind>` config to convert `rem` → `px` since many email clients reject `rem` units.
- Outlook uses Word as its rendering engine. No flexbox, no CSS grid, no box-shadow. Use `<Row>`/`<Column>` from react-email for all layout.

**Resend-specific:**
- Resend Batch API supports up to 100 emails per call — use for abandoned cart and review request jobs.
- Set up Resend webhooks for `email.bounced` to auto-clean bad addresses from customer records.
- Use idempotency keys for critical transactional emails (order confirmation, password reset).
- Resend Audiences can manage unsubscribe lists for marketing-adjacent emails (review requests, win-back).

**Medusa v2 notification constraints:**
- Only one notification provider per channel. Self-hosted = no conflict.
- If deploying to Medusa Cloud with their built-in Medusa Emails, you cannot simultaneously use a custom Resend provider on the `email` channel.
- For dev/testing, use the Local Notification Module Provider (logs to console instead of sending).

**Security considerations:**
- Password reset tokens: verify single-use and expiry in subscriber.
- Invoice download route: validate customer owns the order before serving PDF.
- Admin endpoints: require admin authentication middleware.
- Gift card codes: don't log full codes in notification system logs.
- Abandoned cart: don't include full cart details in recovery URLs (use opaque cart ID, not item data).

---

## Future Considerations (Post-Launch)

These are intentionally deferred but worth noting for the template roadmap:

- **Shipping carrier integration** — real-time tracking updates (out for delivery, delivered, exception) require carrier-specific webhook handlers (ShipStation, EasyPost, etc.)
- **Wishlist + price drop alerts** — requires a custom wishlist module not built into Medusa v2
- **Browse abandonment** — requires frontend event tracking (viewed products → scheduled job)
- **Win-back / re-engagement** — query customers inactive 90+ days, send incentive
- **Marketing double opt-in** — GDPR/CAN-SPAM compliance for newsletter
- **Admin daily/weekly digest** — scheduled job compiling orders, revenue, top products
- **Subscription renewal reminders** — if adding subscription billing
- **Multi-language email templates** — i18n support for international stores
