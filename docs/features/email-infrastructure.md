---
status: in-progress
created: 2026-03-13
updated: 2026-03-30
---

# Email Infrastructure

> **Stacks 1-5 shipped (8 templates + invoice PDF). Stacks 6-7 deferred until production email deliverability is validated.**

## What it does

Complete email notification system for the CrowCommerce storefront — transactional emails (order confirmation, shipping, password reset, etc.), automated recovery (abandoned cart), invoicing, and premium commerce notifications. Built on Medusa v2's event system with Resend as the delivery provider and React Email for templates.

## Phases

### Stack 1: Foundation ✅

- [x] Resend module provider with template resolver map
- [x] UntitledUI-based shared email components restyled with TailwindUI tokens
- [x] Order confirmation template + subscriber + workflow
- [x] `formatOrderForEmailStep` reusable step
- [x] Email preview server (`bun run dev:emails` on port 3003)
- PRs: #13–#16 (merged 2026-03-14)

### Stack 2: Core Auth & Admin Emails ✅

- [x] Password reset template + subscriber
- [x] Admin user invite template + subscriber (handles both `invite.created` and `invite.resent`)
- [x] Customer welcome template + subscriber
- [x] Shared `_helpers/resolve-urls.ts` for DRY URL resolution
- [x] PII masking in log messages
- [x] Email case-sensitivity fix (`.toLowerCase()` on login, signup, checkout)
- PR: #17 (merged 2026-03-15)

### Stack 3: Order Lifecycle Emails ✅

- [x] Shipping confirmation (`shipment.created`)
- [x] Order canceled with refund status (`order.canceled`)
- [x] Refund confirmation (`payment.refunded`)
- [x] Admin new order alert (dual subscriber on `order.placed`, `ADMIN_ORDER_EMAILS` env var)

### Stack 4: Abandoned Cart Recovery ✅

- [x] Scheduled job (every 15 min)
- [x] HMAC-signed recovery links
- [x] Abandoned cart email template
- [x] Storefront recovery route handler

### Stack 5: Invoice Generator ✅

- [x] Invoice data model (custom Medusa v2 module with Invoice + InvoiceConfig)
- [x] PDF generation with @react-pdf/renderer (Modern Minimal layout)
- [x] Invoice download API routes (store + admin)
- [x] Invoice email integration (download link default, admin toggle for PDF attachment)
- [x] Admin settings page for invoice configuration
- [x] Order detail widget in admin dashboard
- [x] Storefront download button on order history

### Stack 6: Premium Notifications ⏳

- [ ] Return flow emails (return requested, return approved/declined)
- [ ] Gift card delivery email
- [ ] Admin low stock alert
- [ ] Post-purchase review request (scheduled job)
- **Deferred:** Resume after production testing of Stacks 1-4.

### Stack 7: Quote Management ⏳

- [ ] Quote data model + backend workflows
- [ ] Quote lifecycle email templates + subscribers
- **Deferred:** Wholesale/B2B specific. Lowest priority — implement when hemp/kratom store needs it.

## Remaining non-stack items

- [x] Add product thumbnail images to email templates
- [x] Order detail page (`/account/orders/[orderId]`) — email "View your order" links now land on the shipped account order detail route

## Key references

- Architecture: [email-infrastructure.md](../architecture/email-infrastructure.md)
- Superpowers specs/plans: [docs/archive/superpowers/](../archive/superpowers/)
