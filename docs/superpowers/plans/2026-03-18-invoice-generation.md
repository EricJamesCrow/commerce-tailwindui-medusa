# Invoice Generation System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-demand PDF invoice generation to CrowCommerce with admin configuration, customer/admin download routes, and optional email attachment.

**Architecture:** Medusa v2 custom module (`invoice`) with two data models (Invoice, InvoiceConfig), a generation workflow using `@react-pdf/renderer`, store/admin API routes, admin UI settings page + order widget, and a conditional email attachment toggle integrated into the existing order confirmation workflow.

**Tech Stack:** Medusa v2, `@react-pdf/renderer`, React, TypeScript, `@medusajs/ui`, Tanstack Query

**Spec:** `docs/superpowers/specs/2026-03-18-invoice-generation-design.md`

---

## File Map

### New Files

```
backend/
├── src/modules/invoice/
│   ├── index.ts                              # Module export
│   ├── service.ts                            # InvoiceModuleService (CRUD + getNextDisplayId + formatInvoiceNumber)
│   └── models/
│       ├── invoice.ts                        # Invoice entity
│       └── invoice-config.ts                 # InvoiceConfig entity (singleton)
├── src/modules/invoice/templates/
│   ├── invoice-document.tsx                  # Top-level <Document> + <Page>
│   ├── styles.ts                             # Shared StyleSheet
│   └── components/
│       ├── header.tsx                        # Invoice number hero, date, order ref
│       ├── parties.tsx                       # From / Bill To columns
│       ├── line-items.tsx                    # Item table
│       ├── totals.tsx                        # Totals card
│       └── footer.tsx                        # Notes + contact
├── src/links/
│   └── invoice-order.ts                      # Invoice → Order link
├── src/workflows/
│   ├── generate-invoice-pdf.ts               # Core generation workflow
│   └── steps/
│       ├── get-or-create-invoice.ts          # Find or create Invoice record
│       ├── format-invoice-data.ts            # Transform order → InvoiceDocumentProps
│       └── render-invoice-pdf.ts             # React PDF → Buffer
├── src/api/
│   ├── store/orders/[id]/invoice/
│   │   └── route.ts                          # Store download route (GET)
│   └── admin/
│       ├── orders/[id]/invoice/
│       │   └── route.ts                      # Admin download route (GET)
│       └── invoice-config/
│           └── route.ts                      # Config GET + POST
└── src/admin/
    ├── routes/settings/invoice-config/
    │   └── page.tsx                           # Invoice config settings page
    └── widgets/
        └── order-invoice.tsx                  # Order detail invoice widget
```

### Modified Files

```
backend/
├── medusa-config.ts                          # Register invoice module
├── src/api/middlewares.ts                     # Add invoice route middleware
├── src/workflows/notifications/
│   └── send-order-confirmation.ts            # Add conditional invoice attachment
└── src/modules/resend/templates/
    └── order-confirmation.tsx                 # Add invoiceMode prop
```

---

## Task 1: Install Dependency

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install @react-pdf/renderer**

```bash
cd backend && bun add @react-pdf/renderer
```

- [ ] **Step 2: Verify installation**

```bash
cd backend && bun run build
```

Expected: Build succeeds. No import errors.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/bun.lock
git commit -m "chore: add @react-pdf/renderer dependency

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Invoice Data Models

**Files:**
- Create: `backend/src/modules/invoice/models/invoice.ts`
- Create: `backend/src/modules/invoice/models/invoice-config.ts`

- [ ] **Step 1: Create Invoice model**

```typescript
// backend/src/modules/invoice/models/invoice.ts
import { model } from "@medusajs/framework/utils"

const Invoice = model.define("invoice", {
  id: model.id({ prefix: "inv" }).primaryKey(),
  display_id: model.number(),
  order_id: model.text().index("IDX_INVOICE_ORDER_ID"),
  year: model.number(),
  generated_at: model.dateTime(),
})

export default Invoice
```

Note: The unique compound index on `[year, display_id]` will be added via the migration. Medusa's `model.define` doesn't support compound unique indexes directly — use a `.checks()` or handle in the generated migration SQL.

- [ ] **Step 2: Create InvoiceConfig model**

```typescript
// backend/src/modules/invoice/models/invoice-config.ts
import { model } from "@medusajs/framework/utils"

const InvoiceConfig = model.define("invoice_config", {
  id: model.id().primaryKey(),
  company_name: model.text(),
  company_address: model.text(),
  company_phone: model.text().nullable(),
  company_email: model.text(),
  company_logo: model.text().nullable(),
  tax_id: model.text().nullable(),
  notes: model.text().nullable(),
  attach_to_email: model.boolean().default(false),
})

export default InvoiceConfig
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/invoice/models/
git commit -m "feat(invoice): add Invoice and InvoiceConfig data models

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Invoice Module Service & Registration

**Files:**
- Create: `backend/src/modules/invoice/service.ts`
- Create: `backend/src/modules/invoice/index.ts`
- Modify: `backend/medusa-config.ts`

- [ ] **Step 1: Create InvoiceModuleService**

```typescript
// backend/src/modules/invoice/service.ts
import { MedusaService } from "@medusajs/framework/utils"
import Invoice from "./models/invoice"
import InvoiceConfig from "./models/invoice-config"

class InvoiceModuleService extends MedusaService({
  Invoice,
  InvoiceConfig,
}) {
  /**
   * Get the next sequential display_id for the given year.
   * Must be called within the same transaction as the invoice creation
   * to prevent race conditions.
   */
  async getNextDisplayId(year: number): Promise<number> {
    const invoices = await this.listInvoices(
      { year },
      { order: { display_id: "DESC" }, take: 1 }
    )

    const maxDisplayId = invoices[0]?.display_id ?? 0
    return maxDisplayId + 1
  }

  /**
   * Format invoice number from year and display_id.
   * Pure function — no database access.
   */
  formatInvoiceNumber(year: number, displayId: number): string {
    return `INV-${year}-${String(displayId).padStart(4, "0")}`
  }
}

export default InvoiceModuleService
```

- [ ] **Step 2: Create module export**

```typescript
// backend/src/modules/invoice/index.ts
import { Module } from "@medusajs/framework/utils"
import InvoiceModuleService from "./service"

export const INVOICE_MODULE = "invoice"

export default Module(INVOICE_MODULE, {
  service: InvoiceModuleService,
})
```

- [ ] **Step 3: Register module in medusa-config.ts**

Add to the `modules` array in `medusa-config.ts`, alongside the existing product-review and wishlist modules:

```typescript
{
  resolve: "./src/modules/invoice",
},
```

- [ ] **Step 4: Generate and run migration**

```bash
cd backend && bunx medusa db:generate invoice
cd backend && bunx medusa db:migrate
```

After the migration is generated, inspect the migration file and add the unique compound index if not present:

```sql
CREATE UNIQUE INDEX "IDX_INVOICE_YEAR_DISPLAY_ID" ON "invoice" ("year", "display_id");
```

- [ ] **Step 5: Build and verify**

```bash
cd backend && bun run build
```

Expected: Build succeeds. Module is registered.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/invoice/ backend/medusa-config.ts backend/src/modules/invoice/migrations/
git commit -m "feat(invoice): add invoice module with service and migration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Invoice → Order Module Link

**Files:**
- Create: `backend/src/links/invoice-order.ts`

- [ ] **Step 1: Create module link**

```typescript
// backend/src/links/invoice-order.ts
import { defineLink } from "@medusajs/framework/utils"
import InvoiceModule from "../modules/invoice"
import OrderModule from "@medusajs/medusa/order"

export default defineLink(
  {
    linkable: InvoiceModule.linkable.invoice,
    field: "order_id",
    isList: false,
  },
  OrderModule.linkable.order,
  {
    readOnly: true,
  }
)
```

- [ ] **Step 2: Generate and run link migration**

```bash
cd backend && bunx medusa db:generate invoiceOrderLink
cd backend && bunx medusa db:migrate
```

- [ ] **Step 3: Build and verify**

```bash
cd backend && bun run build
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/links/invoice-order.ts backend/src/modules/invoice/migrations/
git commit -m "feat(invoice): add invoice-order module link

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: PDF Template — Styles & Components

**Files:**
- Create: `backend/src/modules/invoice/templates/styles.ts`
- Create: `backend/src/modules/invoice/templates/components/header.tsx`
- Create: `backend/src/modules/invoice/templates/components/parties.tsx`
- Create: `backend/src/modules/invoice/templates/components/line-items.tsx`
- Create: `backend/src/modules/invoice/templates/components/totals.tsx`
- Create: `backend/src/modules/invoice/templates/components/footer.tsx`
- Create: `backend/src/modules/invoice/templates/invoice-document.tsx`

- [ ] **Step 1: Create shared styles**

```typescript
// backend/src/modules/invoice/templates/styles.ts
import { StyleSheet } from "@react-pdf/renderer"

export const colors = {
  primary: "#111827",       // gray-900
  secondary: "#6b7280",     // gray-500
  tertiary: "#9ca3af",      // gray-400
  accent: "#4f46e5",        // indigo-600
  background: "#fafafa",    // gray-50
  tableHeader: "#f3f4f6",   // gray-100
  border: "#e5e7eb",        // gray-200
  totalsBackground: "#f9fafb", // gray-50
  white: "#ffffff",
}

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.primary,
    backgroundColor: colors.white,
  },
  // Header
  headerSection: {
    marginBottom: 28,
  },
  invoiceLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.accent,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 24,
    fontFamily: "Helvetica",
    fontWeight: 300,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  headerMeta: {
    fontSize: 9,
    color: colors.tertiary,
    marginTop: 2,
  },
  // Parties
  partiesSection: {
    flexDirection: "row",
    gap: 40,
    marginBottom: 24,
  },
  partyColumn: {
    flex: 1,
  },
  partyLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.tertiary,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 2,
  },
  partyDetail: {
    fontSize: 9,
    color: colors.secondary,
    lineHeight: 1.4,
  },
  // Line Items Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.tableHeader,
    borderRadius: 4,
    padding: "8 12",
    marginBottom: 2,
  },
  tableHeaderText: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.secondary,
  },
  tableRow: {
    flexDirection: "row",
    padding: "10 12",
    borderBottomWidth: 1,
    borderBottomColor: colors.tableHeader,
  },
  tableRowLast: {
    flexDirection: "row",
    padding: "10 12",
  },
  itemName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  itemDetail: {
    fontSize: 8,
    color: colors.tertiary,
    marginTop: 2,
  },
  itemText: {
    fontSize: 10,
    color: colors.secondary,
  },
  itemTotal: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  // Column widths
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: "center" },
  colUnitPrice: { flex: 1, textAlign: "right" },
  colAmount: { flex: 1, textAlign: "right" },
  // Totals
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  totalsCard: {
    width: 200,
    backgroundColor: colors.totalsBackground,
    borderRadius: 6,
    padding: 12,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 10,
    color: colors.secondary,
  },
  totalsValue: {
    fontSize: 10,
    color: colors.secondary,
  },
  totalsDivider: {
    borderTopWidth: 1.5,
    borderTopColor: colors.border,
    marginTop: 4,
    paddingTop: 6,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  totalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  // Footer
  footerSection: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.tableHeader,
  },
  footerText: {
    fontSize: 8,
    color: colors.tertiary,
  },
  footerContact: {
    fontSize: 8,
    color: colors.tertiary,
    marginTop: 2,
  },
})
```

- [ ] **Step 2: Create header component**

```tsx
// backend/src/modules/invoice/templates/components/header.tsx
import { View, Text } from "@react-pdf/renderer"
import { styles } from "../styles"

interface HeaderProps {
  invoiceNumber: string
  issuedDate: string
  orderDisplayId: string
}

export function Header({ invoiceNumber, issuedDate, orderDisplayId }: HeaderProps) {
  return (
    <View style={styles.headerSection}>
      <Text style={styles.invoiceLabel}>Invoice</Text>
      <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
      <Text style={styles.headerMeta}>
        Issued {issuedDate} · Order {orderDisplayId}
      </Text>
    </View>
  )
}
```

- [ ] **Step 3: Create parties component**

```tsx
// backend/src/modules/invoice/templates/components/parties.tsx
import { View, Text } from "@react-pdf/renderer"
import { styles } from "../styles"

interface PartyInfo {
  name: string
  address: string
  email: string
  phone?: string
  taxId?: string
}

interface PartiesProps {
  from: PartyInfo
  billTo: PartyInfo
}

export function Parties({ from, billTo }: PartiesProps) {
  return (
    <View style={styles.partiesSection}>
      <View style={styles.partyColumn}>
        <Text style={styles.partyLabel}>From</Text>
        <Text style={styles.partyName}>{from.name}</Text>
        <Text style={styles.partyDetail}>{from.address}</Text>
        {from.phone && <Text style={styles.partyDetail}>{from.phone}</Text>}
        <Text style={styles.partyDetail}>{from.email}</Text>
        {from.taxId && (
          <Text style={styles.partyDetail}>Tax ID: {from.taxId}</Text>
        )}
      </View>
      <View style={styles.partyColumn}>
        <Text style={styles.partyLabel}>Bill To</Text>
        <Text style={styles.partyName}>{billTo.name}</Text>
        <Text style={styles.partyDetail}>{billTo.address}</Text>
        {billTo.phone && <Text style={styles.partyDetail}>{billTo.phone}</Text>}
        <Text style={styles.partyDetail}>{billTo.email}</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 4: Create line-items component**

```tsx
// backend/src/modules/invoice/templates/components/line-items.tsx
import { View, Text } from "@react-pdf/renderer"
import { styles } from "../styles"

interface LineItem {
  name: string
  variant?: string
  sku?: string
  quantity: number
  unitPrice: string
  total: string
}

interface LineItemsProps {
  items: LineItem[]
}

export function LineItems({ items }: LineItemsProps) {
  return (
    <View>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
        <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
        <Text style={[styles.tableHeaderText, styles.colUnitPrice]}>Unit Price</Text>
        <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
      </View>

      {/* Table Rows */}
      {items.map((item, index) => (
        <View
          key={index}
          style={index < items.length - 1 ? styles.tableRow : styles.tableRowLast}
        >
          <View style={styles.colDescription}>
            <Text style={styles.itemName}>{item.name}</Text>
            {(item.variant || item.sku) && (
              <Text style={styles.itemDetail}>
                {[item.variant, item.sku].filter(Boolean).join(" · ")}
              </Text>
            )}
          </View>
          <Text style={[styles.itemText, styles.colQty]}>{item.quantity}</Text>
          <Text style={[styles.itemText, styles.colUnitPrice]}>{item.unitPrice}</Text>
          <Text style={[styles.itemTotal, styles.colAmount]}>{item.total}</Text>
        </View>
      ))}
    </View>
  )
}
```

- [ ] **Step 5: Create totals component**

```tsx
// backend/src/modules/invoice/templates/components/totals.tsx
import { View, Text } from "@react-pdf/renderer"
import { styles } from "../styles"

interface TotalsProps {
  subtotal: string
  shipping: string
  discount?: string
  tax: string
  total: string
}

export function Totals({ subtotal, shipping, discount, tax, total }: TotalsProps) {
  return (
    <View style={styles.totalsContainer}>
      <View style={styles.totalsCard}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal</Text>
          <Text style={styles.totalsValue}>{subtotal}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Shipping</Text>
          <Text style={styles.totalsValue}>{shipping}</Text>
        </View>
        {discount && (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Discount</Text>
            <Text style={styles.totalsValue}>-{discount}</Text>
          </View>
        )}
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Tax</Text>
          <Text style={styles.totalsValue}>{tax}</Text>
        </View>
        <View style={[styles.totalsRow, styles.totalsDivider]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{total}</Text>
        </View>
      </View>
    </View>
  )
}
```

- [ ] **Step 6: Create footer component**

```tsx
// backend/src/modules/invoice/templates/components/footer.tsx
import { View, Text } from "@react-pdf/renderer"
import { styles } from "../styles"

interface FooterProps {
  companyEmail: string
  notes?: string
}

export function Footer({ companyEmail, notes }: FooterProps) {
  return (
    <View style={styles.footerSection}>
      <Text style={styles.footerText}>
        {notes || "Thank you for your purchase."}
      </Text>
      <Text style={styles.footerContact}>
        Questions? Contact {companyEmail}
      </Text>
    </View>
  )
}
```

- [ ] **Step 7: Create top-level invoice document**

```tsx
// backend/src/modules/invoice/templates/invoice-document.tsx
import { Document, Page } from "@react-pdf/renderer"
import { styles } from "./styles"
import { Header } from "./components/header"
import { Parties } from "./components/parties"
import { LineItems } from "./components/line-items"
import { Totals } from "./components/totals"
import { Footer } from "./components/footer"

export interface InvoiceDocumentProps {
  invoiceNumber: string
  issuedDate: string
  orderDisplayId: string
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
    unitPrice: string
    total: string
  }[]
  subtotal: string
  shipping: string
  discount?: string
  tax: string
  total: string
  currency: string
  notes?: string
}

export function InvoiceDocument(props: InvoiceDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header
          invoiceNumber={props.invoiceNumber}
          issuedDate={props.issuedDate}
          orderDisplayId={props.orderDisplayId}
        />
        <Parties
          from={{
            name: props.company.name,
            address: props.company.address,
            phone: props.company.phone,
            email: props.company.email,
            taxId: props.company.taxId,
          }}
          billTo={{
            name: props.customer.name,
            address: props.customer.address,
            email: props.customer.email,
          }}
        />
        <LineItems items={props.items} />
        <Totals
          subtotal={props.subtotal}
          shipping={props.shipping}
          discount={props.discount}
          tax={props.tax}
          total={props.total}
        />
        <Footer
          companyEmail={props.company.email}
          notes={props.notes}
        />
      </Page>
    </Document>
  )
}
```

- [ ] **Step 8: Build and verify**

```bash
cd backend && bun run build
```

Expected: Build succeeds. All template components compile.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/invoice/templates/
git commit -m "feat(invoice): add PDF template components with Modern Minimal layout

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Workflow Steps

**Files:**
- Create: `backend/src/workflows/steps/get-or-create-invoice.ts`
- Create: `backend/src/workflows/steps/format-invoice-data.ts`
- Create: `backend/src/workflows/steps/render-invoice-pdf.ts`

- [ ] **Step 1: Create get-or-create-invoice step**

```typescript
// backend/src/workflows/steps/get-or-create-invoice.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { INVOICE_MODULE } from "../../modules/invoice"
import type InvoiceModuleService from "../../modules/invoice/service"

export type GetOrCreateInvoiceInput = {
  order_id: string
}

export const getOrCreateInvoiceStep = createStep(
  "get-or-create-invoice",
  async (input: GetOrCreateInvoiceInput, { container }) => {
    const invoiceService: InvoiceModuleService = container.resolve(INVOICE_MODULE)

    // Check if invoice already exists for this order
    const existing = await invoiceService.listInvoices({ order_id: input.order_id })

    if (existing[0]) {
      return new StepResponse({ invoice: existing[0], isNew: false })
    }

    // Create new invoice with next sequential display_id
    const year = new Date().getFullYear()
    const displayId = await invoiceService.getNextDisplayId(year)

    const invoice = await invoiceService.createInvoices({
      display_id: displayId,
      order_id: input.order_id,
      year,
      generated_at: new Date(),
    })

    return new StepResponse(
      { invoice, isNew: true },
      invoice.id
    )
  },
  async (invoiceId, { container }) => {
    if (!invoiceId) return

    const invoiceService: InvoiceModuleService = container.resolve(INVOICE_MODULE)
    await invoiceService.softDeleteInvoices(invoiceId)
  }
)
```

- [ ] **Step 2: Create format-invoice-data step**

This step reuses the existing `createCurrencyFormatter`, `formatAddress`, `formatItem`, and `formatOrderDate` helpers from `src/workflows/notifications/_format-helpers.ts`.

```typescript
// backend/src/workflows/steps/format-invoice-data.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import type InvoiceModuleService from "../../modules/invoice/service"
import { INVOICE_MODULE } from "../../modules/invoice"
import {
  createCurrencyFormatter,
  formatAddress,
  formatOrderDate,
} from "../notifications/_format-helpers"
import type { InvoiceDocumentProps } from "../../modules/invoice/templates/invoice-document"

export type FormatInvoiceDataInput = {
  order: Record<string, any>
  invoice: { display_id: number; year: number }
  config: {
    company_name: string
    company_address: string
    company_phone?: string | null
    company_email: string
    company_logo?: string | null
    tax_id?: string | null
    notes?: string | null
  }
}

export const formatInvoiceDataStep = createStep(
  "format-invoice-data",
  async (input: FormatInvoiceDataInput, { container }) => {
    const invoiceService: InvoiceModuleService = container.resolve(INVOICE_MODULE)
    const { order, invoice, config } = input

    const fmt = createCurrencyFormatter(order.currency_code || "USD")
    const formatMoney = (amount: number) => fmt.format(amount)

    const invoiceNumber = invoiceService.formatInvoiceNumber(
      invoice.year,
      invoice.display_id
    )

    const address = formatAddress(order.shipping_address || order.billing_address)

    const props: InvoiceDocumentProps = {
      invoiceNumber,
      issuedDate: formatOrderDate(order.created_at),
      orderDisplayId: `#${order.display_id || order.id}`,
      company: {
        name: config.company_name,
        address: config.company_address,
        phone: config.company_phone || undefined,
        email: config.company_email,
        logo: config.company_logo || undefined,
        taxId: config.tax_id || undefined,
      },
      customer: {
        name: address.name || order.email,
        address: [address.line1, address.line2, `${address.city}, ${address.state || ""} ${address.postalCode}`.trim(), address.country]
          .filter(Boolean)
          .join("\n"),
        email: order.email,
      },
      items: ((order.items || []) as Record<string, any>[]).map((item) => ({
        name: (item.product_title || item.title) as string,
        variant: (item.variant_title as string) || undefined,
        sku: (item.variant_sku as string) || undefined,
        quantity: item.quantity as number,
        unitPrice: formatMoney(item.unit_price as number),
        total: formatMoney((item.total as number) ?? (item.unit_price as number) * (item.quantity as number)),
      })),
      subtotal: formatMoney(order.item_subtotal ?? order.subtotal ?? 0),
      shipping: formatMoney(order.shipping_total || 0),
      discount: order.discount_total ? formatMoney(order.discount_total) : undefined,
      tax: formatMoney(order.tax_total || 0),
      total: formatMoney(order.total || 0),
      currency: order.currency_code || "USD",
      notes: config.notes || undefined,
    }

    return new StepResponse(props)
  }
)
```

- [ ] **Step 3: Create render-invoice-pdf step**

```typescript
// backend/src/workflows/steps/render-invoice-pdf.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoiceDocument } from "../../modules/invoice/templates/invoice-document"
import type { InvoiceDocumentProps } from "../../modules/invoice/templates/invoice-document"
import React from "react"

export const renderInvoicePdfStep = createStep(
  "render-invoice-pdf",
  async (props: InvoiceDocumentProps) => {
    const buffer = await renderToBuffer(
      React.createElement(InvoiceDocument, props)
    )

    return new StepResponse(buffer)
  }
)
```

Note: Uses `React.createElement` instead of JSX in the step file to avoid needing JSX transform in a `.ts` file. Alternatively, rename to `.tsx` if the build system supports it.

- [ ] **Step 4: Build and verify**

```bash
cd backend && bun run build
```

Expected: Build succeeds. All steps compile.

- [ ] **Step 5: Commit**

```bash
git add backend/src/workflows/steps/get-or-create-invoice.ts backend/src/workflows/steps/format-invoice-data.ts backend/src/workflows/steps/render-invoice-pdf.ts
git commit -m "feat(invoice): add workflow steps for invoice generation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Generate Invoice PDF Workflow

**Files:**
- Create: `backend/src/workflows/generate-invoice-pdf.ts`

- [ ] **Step 1: Create the core workflow**

```typescript
// backend/src/workflows/generate-invoice-pdf.ts
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { getOrCreateInvoiceStep } from "./steps/get-or-create-invoice"
import { formatInvoiceDataStep } from "./steps/format-invoice-data"
import { renderInvoicePdfStep } from "./steps/render-invoice-pdf"

type GenerateInvoicePdfInput = {
  order_id: string
}

export const generateInvoicePdfWorkflow = createWorkflow(
  "generate-invoice-pdf",
  function (input: GenerateInvoicePdfInput) {
    // Step 1: Fetch order with all required fields
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "created_at",
        "currency_code",
        "total",
        "subtotal",
        "item_subtotal",
        "item_total",
        "shipping_total",
        "discount_total",
        "tax_total",
        "items.*",
        "shipping_address.*",
        "billing_address.*",
      ],
      filters: { id: input.order_id },
    })

    const order = transform({ orders }, ({ orders: result }) => {
      const o = result[0]
      if (!o) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "Order not found"
        )
      }
      return o
    })

    // Step 2: Fetch InvoiceConfig
    const { data: configs } = useQueryGraphStep({
      entity: "invoice_config",
      fields: [
        "id",
        "company_name",
        "company_address",
        "company_phone",
        "company_email",
        "company_logo",
        "tax_id",
        "notes",
        "attach_to_email",
      ],
    }).config({ name: "fetch-invoice-config" })

    const config = transform({ configs }, ({ configs: result }) => {
      const c = result[0]
      if (!c) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "Invoice configuration not found. Please configure invoice settings in the admin panel."
        )
      }
      return c
    })

    // Step 3: Get or create Invoice record
    const { invoice } = getOrCreateInvoiceStep({ order_id: input.order_id })

    // Step 4: Format data for PDF template
    const formatInput = transform({ order, invoice, config }, (data) => ({
      order: data.order,
      invoice: { display_id: data.invoice.display_id, year: data.invoice.year },
      config: data.config,
    }))

    const invoiceProps = formatInvoiceDataStep(formatInput)

    // Step 5: Render PDF buffer
    const buffer = renderInvoicePdfStep(invoiceProps)

    return new WorkflowResponse({
      buffer,
      invoiceNumber: invoiceProps.invoiceNumber,
      invoice,
    })
  }
)
```

- [ ] **Step 2: Build and verify**

```bash
cd backend && bun run build
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/workflows/generate-invoice-pdf.ts
git commit -m "feat(invoice): add generate-invoice-pdf workflow

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: API Routes & Middleware

**Files:**
- Create: `backend/src/api/store/orders/[id]/invoice/route.ts`
- Create: `backend/src/api/admin/orders/[id]/invoice/route.ts`
- Create: `backend/src/api/admin/invoice-config/route.ts`
- Modify: `backend/src/api/middlewares.ts`

- [ ] **Step 1: Create store invoice download route**

```typescript
// backend/src/api/store/orders/[id]/invoice/route.ts
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { generateInvoicePdfWorkflow } from "../../../../../workflows/generate-invoice-pdf"
import { INVOICE_MODULE } from "../../../../../modules/invoice"
import type InvoiceModuleService from "../../../../../modules/invoice/service"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const orderId = req.params.id
  const customerId = req.auth_context?.actor_id

  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Authentication required"
    )
  }

  // Verify customer owns this order
  const query = req.scope.resolve("query")
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "customer_id", "items.id"],
    filters: { id: orderId },
  })

  const order = orders[0]

  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  if (order.customer_id !== customerId) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Access denied")
  }

  // Check order has items
  if (!order.items || order.items.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cannot generate invoice for an order with no items"
    )
  }

  const { result } = await generateInvoicePdfWorkflow(req.scope).run({
    input: { order_id: orderId },
  })

  const invoiceService: InvoiceModuleService = req.scope.resolve(INVOICE_MODULE)
  const invoiceNumber = invoiceService.formatInvoiceNumber(
    result.invoice.year,
    result.invoice.display_id
  )

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${invoiceNumber}.pdf"`
  )
  res.send(Buffer.from(result.buffer))
}
```

- [ ] **Step 2: Create admin invoice download route**

```typescript
// backend/src/api/admin/orders/[id]/invoice/route.ts
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { generateInvoicePdfWorkflow } from "../../../../../workflows/generate-invoice-pdf"
import { INVOICE_MODULE } from "../../../../../modules/invoice"
import type InvoiceModuleService from "../../../../../modules/invoice/service"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const orderId = req.params.id

  // Verify order exists and has items (no ownership check for admin)
  const query = req.scope.resolve("query")
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "items.id"],
    filters: { id: orderId },
  })

  const order = orders[0]

  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
  }

  if (!order.items || order.items.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cannot generate invoice for an order with no items"
    )
  }

  const { result } = await generateInvoicePdfWorkflow(req.scope).run({
    input: { order_id: orderId },
  })

  const invoiceService: InvoiceModuleService = req.scope.resolve(INVOICE_MODULE)
  const invoiceNumber = invoiceService.formatInvoiceNumber(
    result.invoice.year,
    result.invoice.display_id
  )

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${invoiceNumber}.pdf"`
  )
  res.send(Buffer.from(result.buffer))
}
```

- [ ] **Step 3: Create admin invoice-config routes**

```typescript
// backend/src/api/admin/invoice-config/route.ts
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { INVOICE_MODULE } from "../../../modules/invoice"
import type InvoiceModuleService from "../../../modules/invoice/service"
import { z } from "@medusajs/framework/zod"

export const PostAdminInvoiceConfigSchema = z.object({
  company_name: z.string().min(1),
  company_address: z.string().min(1),
  company_phone: z.string().nullable().optional(),
  company_email: z.string().email(),
  company_logo: z.string().url().nullable().optional(),
  tax_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  attach_to_email: z.boolean().optional(),
})

export type PostAdminInvoiceConfigReq = z.infer<typeof PostAdminInvoiceConfigSchema>

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const invoiceService: InvoiceModuleService = req.scope.resolve(INVOICE_MODULE)
  const configs = await invoiceService.listInvoiceConfigs()

  res.json({ invoice_config: configs[0] || null })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<PostAdminInvoiceConfigReq>,
  res: MedusaResponse
) => {
  const invoiceService: InvoiceModuleService = req.scope.resolve(INVOICE_MODULE)
  const body = req.validatedBody

  // Upsert: update existing or create new (singleton pattern)
  const existing = await invoiceService.listInvoiceConfigs()

  let config
  if (existing[0]) {
    config = await invoiceService.updateInvoiceConfigs({
      id: existing[0].id,
      ...body,
    })
  } else {
    config = await invoiceService.createInvoiceConfigs(body)
  }

  res.json({ invoice_config: config })
}
```

- [ ] **Step 4: Add middleware configuration**

Add to the `routes` array in `backend/src/api/middlewares.ts`:

```typescript
// Import at top of file
import { PostAdminInvoiceConfigSchema } from "./admin/invoice-config/route"

// Add to routes array:

// --- Store invoice routes ---
{
  method: ["GET"],
  matcher: "/store/orders/:id/invoice",
  middlewares: [
    authenticate("customer", ["session", "bearer"]),
  ],
},
// --- Admin invoice routes ---
{
  method: ["GET"],
  matcher: "/admin/orders/:id/invoice",
  middlewares: [],  // Admin auth is automatic
},
{
  method: ["POST"],
  matcher: "/admin/invoice-config",
  middlewares: [
    validateAndTransformBody(PostAdminInvoiceConfigSchema),
  ],
},
```

- [ ] **Step 5: Build and verify**

```bash
cd backend && bun run build
```

- [ ] **Step 6: Manual test — start dev server and test routes**

```bash
cd backend && bun run dev
```

Test the config route (requires admin auth):
```bash
# Create invoice config
curl -X POST http://localhost:9000/admin/invoice-config \
  -H "Content-Type: application/json" \
  --cookie "connect.sid=<your-session>" \
  -d '{"company_name":"CrowCommerce","company_address":"123 Commerce St, Portland OR 97201","company_email":"support@crowcommerce.com"}'

# Get invoice config
curl http://localhost:9000/admin/invoice-config \
  --cookie "connect.sid=<your-session>"
```

Test the admin invoice download (use a real order ID from your database):
```bash
curl http://localhost:9000/admin/orders/<order-id>/invoice \
  --cookie "connect.sid=<your-session>" \
  -o test-invoice.pdf
```

Expected: A valid PDF file is generated and downloaded.

- [ ] **Step 7: Commit**

```bash
git add backend/src/api/store/orders/\[id\]/invoice/ backend/src/api/admin/orders/\[id\]/invoice/ backend/src/api/admin/invoice-config/ backend/src/api/middlewares.ts
git commit -m "feat(invoice): add store and admin API routes for invoice download and config

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Admin UI — Settings Page & Order Widget

**Files:**
- Create: `backend/src/admin/routes/settings/invoice-config/page.tsx`
- Create: `backend/src/admin/widgets/order-invoice.tsx`

- [ ] **Step 1: Create invoice config settings page**

Create `backend/src/admin/routes/settings/invoice-config/page.tsx`.

This page should follow the pattern from the existing admin reviews page (`src/admin/routes/reviews/page.tsx`):
- Use `@medusajs/ui` components: `Container`, `Heading`, `Input`, `Textarea`, `Switch`, `Button`, `Label`, `toast`
- Use `@tanstack/react-query` for `useQuery` and `useMutation`
- Use `react-hook-form` for form state management
- Fetch config via `sdk.client.fetch("/admin/invoice-config")` on mount
- Save via `sdk.client.fetch("/admin/invoice-config", { method: "POST", body })` on submit
- Logo upload via `sdk.admin.upload.create()` (same pattern as Medusa tutorial)
- Export `defineRouteConfig` with label `"Invoice Configuration"` for admin navigation

Form fields:
- Company Name (Input, required)
- Company Address (Textarea)
- Company Phone (Input)
- Company Email (Input, required)
- Company Logo (file upload button + preview)
- Tax ID (Input)
- Default Notes (Textarea)
- Attach to Email (Switch + label explaining behavior)

- [ ] **Step 2: Create order invoice widget**

Create `backend/src/admin/widgets/order-invoice.tsx`.

This widget should:
- Inject at zone `"order.details.side.before"`
- Use `@medusajs/ui` components: `Container`, `Heading`, `Button`, `Text`, `Badge`
- Check if an Invoice record exists for this order via the module service or a lightweight query
- Show invoice number if exists, or "No invoice generated yet"
- "Download Invoice" button that opens `GET /admin/orders/:id/invoice` in a new tab (browser handles PDF download)
- Export `defineWidgetConfig` with zone `"order.details.side.before"`

Pattern reference: The Medusa tutorial's `src/admin/widgets/order-invoice.tsx` uses `defineWidgetConfig` with `zone: "order.details.side.before"`.

- [ ] **Step 3: Build and verify**

```bash
cd backend && bun run build
```

- [ ] **Step 4: Manual test — open admin dashboard**

1. Start dev server: `cd backend && bun run dev`
2. Navigate to `http://localhost:9000/app`
3. Go to Settings → Invoice Configuration → verify form renders and saves
4. Navigate to any order → verify the invoice widget appears in the sidebar

- [ ] **Step 5: Commit**

```bash
git add backend/src/admin/routes/settings/invoice-config/ backend/src/admin/widgets/order-invoice.tsx
git commit -m "feat(invoice): add admin settings page and order invoice widget

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Order Confirmation Email Integration

**Files:**
- Modify: `backend/src/workflows/notifications/send-order-confirmation.ts`
- Modify: `backend/src/modules/resend/templates/order-confirmation.tsx`

- [ ] **Step 1: Add invoiceMode prop to order confirmation template**

Modify `backend/src/modules/resend/templates/order-confirmation.tsx`:

1. Add to `OrderConfirmationProps` interface:
   ```typescript
   invoiceMode?: "link" | "attachment"
   invoiceDownloadUrl?: string
   ```

2. Add conditional rendering before the footer:
   - When `invoiceMode === "link"` and `invoiceDownloadUrl`: render a "Download Invoice" CTA button (use existing `Button` component with `variant="primary"`)
   - When `invoiceMode === "attachment"`: render a `Text` component saying "Your invoice is attached to this email."
   - When `invoiceMode` is undefined (backwards compatibility): render nothing

3. Update `isValidOrderConfirmationData` to accept the new optional fields (no changes needed since they're optional)

- [ ] **Step 2: Modify sendOrderConfirmationWorkflow**

Modify `backend/src/workflows/notifications/send-order-confirmation.ts`:

1. Add imports for the invoice module and workflow steps
2. After the existing `formatOrderForEmailStep`, add a conditional branch:

```typescript
// Fetch InvoiceConfig to check attach_to_email toggle
const { data: invoiceConfigs } = useQueryGraphStep({
  entity: "invoice_config",
  fields: ["attach_to_email"],
}).config({ name: "fetch-invoice-config-for-email" })

const invoiceConfig = transform({ invoiceConfigs }, ({ invoiceConfigs: configs }) => {
  return configs[0] || null
})
```

3. Use `when()` to conditionally generate the invoice for attachment:

```typescript
when({ invoiceConfig }, (data) => data.invoiceConfig?.attach_to_email === true).then(
  function () {
    // Generate invoice PDF for attachment
    // Use try-catch logic in the step to handle failures gracefully
    // On failure, fall back to link mode
  }
)
```

4. In the `transform` that builds the notifications array, conditionally include:
   - `emailOptions.attachments` with the PDF buffer (when attachment mode)
   - `invoiceMode: "link"` with `invoiceDownloadUrl` (when link mode, the default)

**Critical resilience requirement:** If the invoice PDF generation fails (e.g., InvoiceConfig not configured, @react-pdf/renderer error), the order confirmation email MUST still send. Catch errors from the invoice steps and fall back to link mode (or no invoice reference at all). Log the failure for admin visibility. Never block the confirmation email.

- [ ] **Step 3: Build and verify**

```bash
cd backend && bun run build
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/workflows/notifications/send-order-confirmation.ts backend/src/modules/resend/templates/order-confirmation.tsx
git commit -m "feat(invoice): integrate invoice attachment toggle into order confirmation email

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: Storefront — Download Invoice Button

**Files:**
- Modify: Order detail page in `storefront/` (locate the customer order view component)

- [ ] **Step 1: Identify the order detail component**

Search the storefront for the customer order detail page:
- Check `storefront/app/(store)/account/orders/` or similar route
- Find the component that displays a single order's details

- [ ] **Step 2: Add "Download Invoice" button**

Add a button/link to the order detail page:
- Only show for orders with status `completed` or `fulfilled` (not `pending`, `canceled`, `refunded`)
- Use the Medusa JS SDK to trigger the download: `sdk.client.fetch('/store/orders/{orderId}/invoice')`
- Handle the PDF response — open in new tab or trigger browser download
- Handle errors gracefully (show toast or inline message if invoice generation fails)

Example approach:
```typescript
const handleDownloadInvoice = async () => {
  try {
    const response = await fetch(`/api/invoice/${orderId}`)
    // or via a Next.js API route that proxies to Medusa
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `invoice-${orderId}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // Show error to user
  }
}
```

Note: The exact implementation depends on the storefront's existing order detail page structure. The implementer should follow the existing component patterns (RSC vs client component, styling conventions, etc.).

- [ ] **Step 3: Build and verify**

```bash
cd storefront && bun run build
```

- [ ] **Step 4: Manual test**

1. Start dev: `bun run dev` (from root — starts both storefront and backend)
2. Log in as a customer with completed orders
3. Navigate to My Orders → click an order → verify "Download Invoice" button appears
4. Click the button → verify a PDF downloads

- [ ] **Step 5: Commit**

```bash
git add storefront/
git commit -m "feat(storefront): add download invoice button to order detail page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Full build check**

```bash
bun run build
```

Expected: Both storefront and backend build successfully.

- [ ] **Step 2: End-to-end manual test**

1. Start dev servers: `bun run dev`
2. Admin: Configure invoice settings at Settings → Invoice Configuration
3. Admin: Navigate to an order → download invoice via widget
4. Customer: Log in → My Orders → download invoice from order detail
5. (If attach_to_email enabled) Place a test order → verify invoice PDF is attached to confirmation email

- [ ] **Step 3: Commit any remaining fixes**

If any fixes were needed during verification, commit them.

- [ ] **Step 4: Final commit — update docs**

Update `docs/README.md` to reflect the new feature:

```markdown
| [Invoice generation](features/invoice-generation.md) | ✅ Shipped | On-demand PDF, admin config, email toggle | — |
```

```bash
git add docs/
git commit -m "docs: add invoice generation to feature status

Co-Authored-By: Claude <noreply@anthropic.com>"
```
