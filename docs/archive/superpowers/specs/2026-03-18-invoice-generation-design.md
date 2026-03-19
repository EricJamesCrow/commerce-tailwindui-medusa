# Invoice Generation System — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Reference:** [Medusa Invoice Generator Tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/invoice-generator)

## Overview

PDF invoice generation for CrowCommerce (Medusa v2). Invoices are generated on demand using `@react-pdf/renderer` — no PDF persistence. A lightweight data model tracks invoice numbers and provides an audit trail.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PDF library | `@react-pdf/renderer` | React component model consistent with existing react-email templates |
| Storage | Regenerate on demand | No S3 dependency (not yet configured), no storage cost, template/branding changes apply immediately |
| Invoice numbering | `INV-{YEAR}-{AUTO_INCREMENT}` with year-scoped counter | Sequential, resets per year, requires a data model |
| Data model | Lightweight Invoice entity + separate InvoiceConfig | Track invoice numbers and audit trail without persisting the PDF binary |
| Email behavior | Download link by default, admin toggle for PDF attachment | Decouples PDF generation from email critical path; attachment is opt-in |
| PDF layout | Modern Minimal (light background) | Print-friendly, large invoice number as hero element, contemporary feel |
| Module structure | PDF components inside the invoice module | Self-contained, follows existing review/wishlist module patterns |

## Data Model

### Invoice (`src/modules/invoice/models/invoice.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `id` | primaryKey | Prefix `inv_` |
| `display_id` | integer | Set by application logic (NOT autoincrement). Year-scoped sequential counter. |
| `order_id` | text, indexed | Links to Medusa order |
| `year` | integer | Year for numbering scope (e.g., 2026) |
| `generated_at` | dateTime | When the invoice record was first created |

- **Unique compound index** on `[year, display_id]` to prevent duplicates under race conditions.
- Invoice number is derived at render time: `INV-${year}-${String(displayId).padStart(4, '0')}`. Not stored as a field.

### InvoiceConfig (`src/modules/invoice/models/invoice-config.ts`)

Singleton — one row per store.

| Field | Type | Notes |
|-------|------|-------|
| `id` | primaryKey | |
| `company_name` | text | Required |
| `company_address` | text | Full address block |
| `company_phone` | text, nullable | |
| `company_email` | text | |
| `company_logo` | text, nullable | URL to logo image |
| `tax_id` | text, nullable | Tax/business registration number |
| `notes` | text, nullable | Default footer notes (e.g., "Terms: Due on receipt") |
| `attach_to_email` | boolean, default false | Toggle for email attachment behavior |

### Module Link

Invoice → Order (`invoice.order_id` field, read-only, non-list). Follows the existing `review-product` link pattern in `src/links/`.

## Service Layer

### InvoiceModuleService (`src/modules/invoice/service.ts`)

Extends `MedusaService` — auto-generated CRUD for both models. Two custom methods:

- **`getNextDisplayId(year: number): Promise<number>`** — queries `MAX(display_id) WHERE year = currentYear`, returns `max + 1` or `1`. The query + insert must happen within the same transaction to prevent race conditions.
- **`formatInvoiceNumber(year: number, displayId: number): string`** — pure function: returns `INV-${year}-${String(displayId).padStart(4, '0')}`.

## PDF Template

React PDF components using `@react-pdf/renderer`, inside the module:

```
src/modules/invoice/templates/
├── invoice-document.tsx    # Top-level <Document> + <Page> composition
├── components/
│   ├── header.tsx          # Large invoice number hero, issued date, order reference
│   ├── parties.tsx         # From/Bill To side-by-side columns
│   ├── line-items.tsx      # Rounded header row, item rows with SKU/variant
│   ├── totals.tsx          # Subtotal/shipping/tax/total in soft card
│   └── footer.tsx          # Thank you note, contact info, custom notes
└── styles.ts               # Shared StyleSheet (light theme, system fonts)
```

### InvoiceDocumentProps

```typescript
interface InvoiceDocumentProps {
  invoiceNumber: string           // "INV-2026-0001"
  issuedDate: string              // Formatted date
  orderDisplayId: string          // "#1042"
  company: {
    name: string
    address: string
    phone?: string
    email: string
    logo?: string
    taxId?: string
  }
  customer: {
    name: string
    address: string
    email: string
  }
  items: {
    name: string
    variant?: string
    sku?: string
    quantity: number
    unitPrice: string             // Formatted currency
    total: string                 // Formatted currency
  }[]
  subtotal: string
  shipping: string
  discount?: string
  tax: string
  total: string
  currency: string
  notes?: string                  // From InvoiceConfig.notes
}
```

### Visual Design

Modern Minimal layout (light background, print-friendly):
- Large invoice number as hero element at top
- "From" / "Bill To" side-by-side below
- Line items table with rounded gray header row, item rows with name + SKU/variant detail
- Totals in a soft gray card, right-aligned
- Footer with thank you message and contact info

## Workflows

### `generate-invoice-pdf` (core workflow)

Steps:
1. **`useQueryGraphStep`** — fetch order: `id`, `display_id`, `created_at`, `currency_code`, `total`, `subtotal`, `shipping_total`, `discount_total`, `tax_total`, `items.*`, `shipping_address.*`, `billing_address.*`
2. **`useQueryGraphStep`** — fetch InvoiceConfig (singleton)
3. **`getOrCreateInvoiceStep`** — checks if Invoice record exists for `order_id`. If yes, returns it. If no, calls `getNextDisplayId(year)`, creates the record. Returns `{ invoice, isNew }`.
4. **`formatInvoiceDataStep`** — transforms raw order + config + invoice into typed `InvoiceDocumentProps` (currency formatting via `Intl.NumberFormat`, address assembly, invoice number derivation)
5. **`renderInvoicePdfStep`** — imports `@react-pdf/renderer`, builds React component tree, calls `renderToBuffer()`, returns `Buffer`

Returns `{ buffer, invoiceNumber, invoice }`.

### `send-order-confirmation` (modify existing workflow)

Conditional branch using `when()`:

- **`when(invoiceConfig.attach_to_email === true)`:**
  - Execute invoice generation steps
  - Pass buffer into `sendNotificationsStep` via `emailOptions.attachments`
  - **Critical:** If invoice generation fails, catch the error and fall back to sending the email with a download link instead. The order confirmation email must never be blocked by a PDF rendering failure. Log the failure for admin visibility.
- **Default (attach_to_email false):**
  - Existing flow unchanged
  - Email template receives `invoiceDownloadUrl` prop, renders "Download Invoice" CTA button

### `create-invoice-config` (admin setup)

Simple wrapper around module service create/update for the InvoiceConfig singleton.

## Subscribers

**No new subscribers.** The existing `order-placed` subscriber already triggers `sendOrderConfirmationWorkflow`. Invoice generation is either:
- Embedded in the confirmation workflow (when `attach_to_email` is true)
- Triggered lazily when customer/admin hits the download route

Invoice records are created on first access, not eagerly on every order.

## API Routes

### Store Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/store/orders/:id/invoice` | GET | `authenticate("customer", ["session", "bearer"])` | Generate + download PDF |

Behavior:
1. Validate authenticated customer owns this order (check `customer_id` matches `req.auth_context.actor_id`)
2. Validate order has items (return meaningful error for empty/fully-refunded orders)
3. Execute `generateInvoicePdfWorkflow`
4. Return buffer with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="INV-2026-0001.pdf"`

### Admin Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/admin/orders/:id/invoice` | GET | `authenticate("user", ["session", "bearer"])` | Generate + download PDF (no ownership check) |
| `/admin/invoice-config` | GET | `authenticate("user", ...)` | Get current InvoiceConfig |
| `/admin/invoice-config` | POST | `authenticate("user", ...)` | Create or update InvoiceConfig |

### Middleware

- Zod validation on `POST /admin/invoice-config` body: `company_name` required, all other fields optional
- Authentication on all invoice routes
- `queryConfig` on GET routes with appropriate fields

## Admin UI

### Invoice Config Settings Page

`src/admin/routes/settings/invoice-config/page.tsx`

- Located at **Settings → Invoice Configuration**
- Form fields: company name, address, phone, email, logo upload, tax ID, notes, attach-to-email toggle (Switch component)
- Uses `@medusajs/ui` components (Input, Textarea, Switch, Button)
- Logo upload via `sdk.admin.upload.create()`
- Tanstack Query for data fetching + react-hook-form for form state

### Order Invoice Widget

`src/admin/widgets/order-invoice.tsx`

- Injected at zone `order.details.side.before`
- Shows invoice number if one exists for this order
- "Download Invoice" button hits `GET /admin/orders/:id/invoice`
- First click creates the record and returns the PDF; subsequent clicks regenerate from the existing record

## Storefront Integration

### Order Detail Page

- "Download Invoice" button on customer's order detail view
- Hits `/store/orders/:id/invoice` via Medusa JS SDK: `sdk.client.fetch()`
- Only shown for completed/fulfilled orders (not pending or canceled)
- First click triggers lazy generation (creates Invoice record + returns PDF)

### Order Confirmation Email Template

Modify existing `order-confirmation.tsx`:

- New prop: `invoiceMode: "link" | "attachment"`
- `"link"` (default): renders "Download Invoice" CTA button linking to store invoice route
- `"attachment"`: renders "See attached invoice" text (PDF attached via `emailOptions.attachments`)
- Workflow determines mode based on `InvoiceConfig.attach_to_email`

## Module Registration

Add to `medusa-config.ts`:

```typescript
modules: [
  { resolve: "./src/modules/invoice" },
  // ... existing modules
]
```

Migration: `bunx medusa db:generate invoice`

## Edge Cases

- **Empty/canceled orders:** Return a clear error from the download route, not a blank PDF
- **InvoiceConfig not configured:** Return a helpful error message from the download route indicating that invoice settings need to be configured first
- **Race conditions on `display_id`:** Unique compound index on `[year, display_id]` as safety net; query + insert within same transaction
- **PDF rendering failure during email:** Fall back to link-based email, log the error, never block order confirmation
- **Year boundary:** First invoice of a new year gets `display_id: 1` automatically via `getNextDisplayId()` query

## Dependencies

New packages (backend only):
- `@react-pdf/renderer` — React-based PDF generation
- `@react-pdf/types` — TypeScript types (if separate package)

No new storefront dependencies.

## File Summary

```
backend/
├── src/modules/invoice/
│   ├── index.ts                    # Module export
│   ├── service.ts                  # InvoiceModuleService
│   ├── models/
│   │   ├── invoice.ts              # Invoice entity
│   │   └── invoice-config.ts       # InvoiceConfig entity
│   └── templates/
│       ├── invoice-document.tsx    # Top-level Document + Page
│       ├── components/
│       │   ├── header.tsx
│       │   ├── parties.tsx
│       │   ├── line-items.tsx
│       │   ├── totals.tsx
│       │   └── footer.tsx
│       └── styles.ts
├── src/links/
│   └── invoice-order.ts            # Invoice → Order link
├── src/workflows/
│   ├── generate-invoice-pdf.ts     # Core generation workflow
│   ├── create-invoice-config.ts    # Admin config workflow
│   └── steps/
│       ├── get-or-create-invoice.ts
│       ├── format-invoice-data.ts
│       └── render-invoice-pdf.ts
├── src/api/
│   ├── store/orders/[id]/invoice/
│   │   └── route.ts                # Store download route
│   └── admin/
│       ├── orders/[id]/invoice/
│       │   └── route.ts            # Admin download route
│       └── invoice-config/
│           └── route.ts            # Config GET + POST
└── src/admin/
    ├── routes/settings/invoice-config/
    │   └── page.tsx                # Settings page
    └── widgets/
        └── order-invoice.tsx       # Order detail widget

storefront/
└── (order detail page modification — add Download Invoice button)
└── (order confirmation email template — add invoiceMode prop)
```
