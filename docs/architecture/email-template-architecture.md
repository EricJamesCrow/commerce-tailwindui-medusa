# Email Template Architecture: UntitledUI Audit + TailwindUI Token Mapping

**Status:** Approved
**Date:** 2026-03-13
**Companion doc:** `docs/crowcommerce-email-plan-v2.md` (template list, Medusa integration, subscribers, workflows, jobs)
**Scope:** This spec covers the component inventory, token mapping, directory structure, and TypeScript interfaces for the email template system. It does NOT cover Medusa backend integration (subscribers, workflows, scheduled jobs) — that architecture is defined in the v2 plan.

---

## 1. UntitledUI React-Email Component Inventory

### Source analyzed

- `/Users/itsjusteric/CrowDevelopment/Templates/ai-chatbot-untitledui/packages/email/`
- `/Users/itsjusteric/Developer/smartpockets/packages/email/`

Both contain identical UntitledUI react-email template packages.

### react-email components used (13 total from 2 packages)

| Component | Package | Usage |
|-----------|---------|-------|
| `Html` | `@react-email/components` | Root wrapper for every template |
| `Head` | `@react-email/components` | Meta tags (wrapped by custom `Head`) |
| `Body` | `@react-email/components` | Email body (wrapped by custom `Body`) |
| `Preview` | `@react-email/components` | Preview text shown in inbox list |
| `Container` | `@react-email/components` | Centered content wrapper (max-w-160 = 640px) |
| `Section` | `@react-email/components` | Content grouping within container |
| `Row` | `@react-email/components` | Table-row-based horizontal layout |
| `Column` | `@react-email/components` | Table-cell-based column within Row |
| `Text` | `@react-email/components` | Paragraph text (wrapped by custom `Text`) |
| `Button` | `@react-email/components` | CTA links styled as buttons (wrapped by custom `Button`) |
| `Img` | `@react-email/components` | Images (logos, social icons) |
| `Hr` | `@react-email/components` | Horizontal rule dividers |
| `Tailwind` | `@react-email/tailwind` | Tailwind CSS provider |

No `Font`, `Heading`, `Link`, `CodeBlock`, or other react-email components are used. Do not introduce them.

### npm packages to install

```json
{
  "dependencies": {
    "@react-email/components": "^0.4.0",
    "@react-email/tailwind": "^1.2.2"
  },
  "devDependencies": {
    "react-email": "^3.0.6"
  }
}
```

### UntitledUI shared components — keep/drop/adapt matrix

| Component | File | Action | Notes |
|-----------|------|--------|-------|
| `Body` | `body.tsx` | **Keep as-is** | Wraps EmailBody with `bg-secondary font-body` |
| `Button` | `button.tsx` | **Keep as-is** | Primary/secondary CTA with `cx()` variants |
| `Head` | `head.tsx` | **Keep as-is** | Adds `color-scheme` meta |
| `Tailwind` | `tailwind.tsx` | **Keep as-is** | Wraps @react-email/tailwind with theme injection |
| `Text` | `text.tsx` | **Keep as-is** | Wraps EmailText with margin reset |
| `Header` | `header.tsx` | **Adapt** | Swap `Logo` sub-component: use `config.companyName` for text wordmark (never hardcoded), swap social icon CDN URLs. Note: the wordmark fallback uses **inline styles** with hardcoded hex colors (`#181d27`, `#099250`), not Tailwind classes — these must be updated to CrowCommerce brand colors or replaced with Tailwind classes referencing semantic tokens. |
| `Footer` | `footer.tsx` | **Adapt** | Same Logo swap, same social icon URL swap. Same inline-style hex values in wordmark fallback need updating. |
| `LineItems` | `line-items.tsx` | **Keep as-is** | LineItems table + PaymentDetails — already perfect for commerce |
| `PricingTable` | `pricing-table.tsx` | **Drop** | SaaS-specific, not needed for ecommerce |

### UntitledUI utility — keep

| File | Action | Notes |
|------|--------|-------|
| `cx.ts` | **Keep as-is** | Simple classname concatenation, no tailwind-merge needed |

### New commerce-specific components to add

Follow UntitledUI patterns: named exports, typed props, styled via semantic Tailwind classes.

| Component | File | Purpose |
|-----------|------|---------|
| `OrderSummary` | `order-summary.tsx` | Order-level cost breakdown (subtotal, shipping, discount, tax, total). Distinct from `LineItems` which renders the itemized product table — `OrderSummary` sits below it as a cost summary section. |
| `AddressBlock` | `address-block.tsx` | Shipping/billing address display |
| `OrderStatusBadge` | `order-status-badge.tsx` | Visual status indicator (confirmed, shipped, delivered, canceled) |

### Default header/footer variants

CrowCommerce templates use **`LeftAligned`** for both header and footer as the default variant. This provides the cleanest transactional email layout: logo left-aligned in header, unsubscribe/legal text + logo + social icons left-aligned in footer. Templates may use other variants where appropriate (e.g., `CenterAligned` header for marketing emails like welcome or review-request).

### Export convention

Every template exports both a **named export** and a **default export**, matching UntitledUI's pattern:

```tsx
export const OrderConfirmation = (props: OrderConfirmationProps) => { ... };
export default OrderConfirmation;
```

The `service.ts` template resolver uses a map of named exports:

```tsx
const templates = { 'order-confirmation': OrderConfirmation, ... };
```

### UntitledUI template structure pattern

Every template follows this JSX skeleton:

```tsx
<Html>
  <Tailwind theme={theme}>
    <Head />
    <Preview>Preview text here</Preview>
    <Body>
      <Container align="center" className="w-full max-w-160 bg-primary md:p-8">
        <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
        <Section align="left" className="max-w-full px-6 py-8">
          {/* Template content */}
        </Section>
        <Footer
          companyName={config.companyName}
          copyrightYear={config.copyrightYear}
          legalLinks={config.legalLinks}
        />
      </Container>
    </Body>
  </Tailwind>
</Html>
```

Config merge at top of every template:

```tsx
const config = { ...defaultEmailConfig, ...brandConfig };
const greeting = recipientName ? `Hi ${recipientName},` : "Hi there,";
```

### UntitledUI styling approach

- **All styling via Tailwind classes** — no inline styles, no CSS modules, no style objects. Exception: the header/footer `Logo` wordmark fallback uses an inline style for the text color (`#111827`) because it renders outside the `<Tailwind>` wrapper context in some paths. Raw hex values are disallowed elsewhere.
- **Semantic color tokens** — `bg-primary`, `text-tertiary`, never raw hex values in templates
- **`cx()` utility** for conditional class composition (simple concatenation)
- **Light/dark theme** — via `<Tailwind theme={theme}>` prop injecting different token values
- **Responsive** — `md:` breakpoint for desktop vs mobile (breakpoint at 600px)
- **Email-safe only** — no flexbox, CSS grid, or box-shadow in layout (UntitledUI uses table-based Row/Column)

---

## 2. Token Mapping: UntitledUI → TailwindUI

### Architecture

Same 3-file structure as UntitledUI, but lean:

- `colors.ts` — primitive color palette (~60 values instead of 500+)
- `theme-colors.ts` — semantic mappings (15 tokens instead of 300+)
- `theme.ts` — Tailwind config assembly (spacing, fonts, radii, shadows — **unchanged from UntitledUI**)

### Primitive colors: brand scale

| Token | UntitledUI (green) | CrowCommerce (indigo) |
|-------|-------------------|----------------------|
| `brand-25` | `#f6fef9` | `#eef2ff` |
| `brand-50` | `#edfdf2` | `#e0e7ff` |
| `brand-100` | `#d3f8df` | `#c7d2fe` |
| `brand-200` | `#aaf0c4` | `#a5b4fc` |
| `brand-300` | `#73e2a3` | `#818cf8` |
| `brand-400` | `#3ccf7f` | `#818cf8` (indigo-400, separated from 500) |
| `brand-500` | `#16b364` | `#6366f1` |
| `brand-600` | `#099250` | **`#4f46e5`** (primary brand) |
| `brand-700` | `#087443` | `#4338ca` |
| `brand-800` | `#095c37` | `#3730a3` |
| `brand-900` | `#084c2e` | `#312e81` |
| `brand-950` | `#052e1c` | `#1e1b4b` |

### Primitive colors: gray scale

| Token | UntitledUI | CrowCommerce (TailwindUI gray) |
|-------|-----------|-------------------------------|
| `gray-25` | `#fdfdfd` | `#fcfcfd` |
| `gray-50` | `#fafafa` | `#f9fafb` |
| `gray-100` | `#f5f5f5` | `#f3f4f6` |
| `gray-200` | `#e9eaeb` | `#e5e7eb` |
| `gray-300` | `#d5d7da` | `#d1d5db` |
| `gray-400` | `#a4a7ae` | `#9ca3af` |
| `gray-500` | `#717680` | `#6b7280` |
| `gray-600` | `#535862` | `#4b5563` |
| `gray-700` | `#414651` | `#374151` |
| `gray-800` | `#252b37` | `#1f2937` |
| `gray-900` | `#181d27` | `#111827` |
| `gray-950` | `#0a0d12` | `#030712` |

### Primitive colors: status (unchanged)

Error, warning, and success scales are kept identical to UntitledUI. Red/amber/green for status colors are universal.

### Semantic tokens (15 total — what templates and shared components actually reference)

| Tailwind class used | Semantic token | Resolves to |
|---------------------|----------------|-------------|
| `bg-primary` | `bg-primary` | `white` |
| `bg-secondary` | `bg-secondary` | `gray-50` |
| `bg-button-primary-bg` | `button-primary-bg` | `brand-600` (indigo-600) |
| `bg-button-secondary-bg` | `button-secondary-bg` | `white` |
| `border-button-primary-bg` | `button-primary-bg` | `brand-600` (used as border on primary button) |
| `border-button-secondary-border` | `button-secondary-border` | `gray-300` (secondary button border) |
| `text-primary` | `text-primary` | `gray-900` |
| `text-secondary` | `text-secondary` | `gray-700` |
| `text-tertiary` | `text-tertiary` | `gray-600` |
| `text-brand-secondary` | `text-brand-secondary` | `brand-700` (indigo-700) |
| `text-button-primary-fg` | `button-primary-fg` | `white` |
| `text-button-secondary-fg` | `button-secondary-fg` | `gray-700` |
| `border-secondary` | `border-secondary` | `gray-200` |
| `border-brand` | `border-brand` | `brand-500` (indigo-500) |
| `bg-brand-secondary` | `bg-brand-secondary` | `brand-100` (indigo-100) |

### Typography, spacing, radii, shadows (unchanged from UntitledUI)

| Property | Value | Notes |
|----------|-------|-------|
| Font family | `Inter, -apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif` | Same in both systems |
| Text sizes | xs(12px), sm(14px), md(16px), lg(18px), xl(20px) | Keep as-is |
| Display sizes | display-xs(24px) through display-2xl(72px) | Keep as-is |
| Spacing | `rem(px)` scale: 0.5=2px, 1=4px, ... 160=640px | px-based for email safety |
| Border radius | xs(4px), md(6px), lg(8px), xl(12px) | Keep as-is |
| Shadows | xs, sm, md | Keep as-is |
| Max width | `max-w-160` = 640px | Standard email width |
| Breakpoint | `xs: 600px` | Mobile breakpoint |

---

## 3. Directory Structure

```text
backend/src/modules/resend/
├── index.ts                          # ModuleProvider registration
├── service.ts                        # Extends AbstractNotificationProviderService
└── templates/
    ├── _components/                   # Mirrors UntitledUI shared components
    │   ├── body.tsx                   # EmailBody wrapper (bg-secondary, font-body)
    │   ├── button.tsx                 # Primary/secondary CTA (cx-composed variants)
    │   ├── footer.tsx                 # 6 variants: LeftAligned, CenterAligned, etc.
    │   ├── head.tsx                   # EmailHead with color-scheme meta
    │   ├── header.tsx                 # 6 variants with Logo sub-component
    │   ├── line-items.tsx             # LineItems table + PaymentDetails
    │   ├── tailwind.tsx               # Tailwind wrapper with theme injection
    │   └── text.tsx                   # EmailText with margin reset
    │
    ├── _commerce/                     # New: ecommerce-specific components
    │   ├── order-summary.tsx          # Subtotal, shipping, tax, total
    │   ├── address-block.tsx          # Shipping/billing address display
    │   └── order-status-badge.tsx     # Status indicator (confirmed/shipped/etc.)
    │
    ├── _config/
    │   └── email-config.ts            # EmailBrandConfig for CrowCommerce
    │
    ├── _theme/
    │   ├── colors.ts                  # Primitive palette (~60 values)
    │   ├── theme-colors.ts            # 15 semantic token mappings
    │   └── theme.ts                   # Tailwind config assembly (unchanged)
    │
    ├── utils/
    │   └── cx.ts                      # Simple classname concatenation
    │
    ├── order-confirmation.tsx          # Customer-facing templates
    ├── shipping-confirmation.tsx
    ├── order-canceled.tsx
    ├── refund-confirmation.tsx
    ├── password-reset.tsx
    ├── welcome.tsx
    ├── abandoned-cart.tsx
    ├── invoice-ready.tsx
    ├── payment-failed.tsx
    ├── return-requested.tsx
    ├── return-status.tsx
    ├── gift-card-delivery.tsx
    ├── quote-request-received.tsx
    ├── quote-sent.tsx
    ├── quote-status.tsx
    ├── review-request.tsx
    ├── invite-user.tsx
    ├── email-verification.tsx
    ├── restock-notification.tsx
    │
    ├── admin-new-order.tsx             # Admin-facing templates
    ├── admin-low-stock.tsx
    └── admin-daily-digest.tsx
```

### Change matrix: what to copy, adapt, or write from scratch

| File | Action | Details |
|------|--------|---------|
| `_components/body.tsx` | **Copy verbatim** | No changes needed |
| `_components/button.tsx` | **Copy verbatim** | No changes needed |
| `_components/head.tsx` | **Copy verbatim** | No changes needed |
| `_components/tailwind.tsx` | **Copy verbatim** | No changes needed |
| `_components/text.tsx` | **Copy verbatim** | No changes needed |
| `_components/line-items.tsx` | **Copy verbatim** | No changes needed |
| `_components/header.tsx` | **Surgical edit** | Swap `Logo` sub-component text wordmark to use `config.companyName`, swap social icon CDN URLs |
| `_components/footer.tsx` | **Surgical edit** | Same Logo swap, same social icon URL swap |
| `_config/email-config.ts` | **Rewrite** | CrowCommerce defaults (companyName, URLs, social links) + keep `getEmailConfig()` deep merge helper |
| `_theme/colors.ts` | **Rewrite** | Indigo brand scale + TailwindUI gray scale + status colors (~60 primitives) |
| `_theme/theme-colors.ts` | **Rewrite** | 15 semantic tokens mapping to new primitives |
| `_theme/theme.ts` | **Copy verbatim** | Spacing, fonts, radii, shadows unchanged |
| `utils/cx.ts` | **Copy verbatim** | No changes needed |
| `_commerce/*.tsx` | **Write from scratch** | 3 new ecommerce components following UntitledUI patterns |
| All template `*.tsx` | **Write from scratch** | 22 templates following UntitledUI JSX skeleton |

---

## 4. TypeScript Interfaces

### Base pattern (every template includes these)

```typescript
interface BaseTemplateProps {
  theme?: "light" | "dark";
  brandConfig?: Partial<EmailBrandConfig>;
}
```

### Shared types

```typescript
// Re-exported from line-items.tsx (UntitledUI's existing interface, unchanged)
interface LineItem {
  name: string;
  quantity?: number;
  price: string;
}

// New: extends LineItem for ecommerce templates needing richer item display
interface CommerceLineItem extends LineItem {
  imageUrl?: string;
  variant?: string;
  sku?: string;
}

// New: used by order/shipping/return templates
interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
}
```

**`CommerceLineItem` usage:** order-confirmation, shipping-confirmation, order-canceled, return-requested, return-status, review-request, abandoned-cart, admin-new-order.

**Basic `LineItem` usage:** quote-*, invoice-ready, refund-confirmation, gift-card-delivery.

### Customer-facing templates

```typescript
// order-confirmation.tsx
interface OrderConfirmationProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber: string;
  orderDate: string;
  items: CommerceLineItem[];
  subtotal: string;
  shipping: string;
  tax?: string;
  total: string;
  paymentMethod: string;
  cardLast4?: string;
  shippingAddress: Address;
  billingAddress?: Address;
  orderStatusUrl?: string;
}

// shipping-confirmation.tsx
interface ShippingConfirmationProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  items: CommerceLineItem[];
  shippingAddress: Address;
  estimatedDelivery?: string;
}

// order-canceled.tsx
interface OrderCanceledProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber: string;
  reason?: string;
  items: CommerceLineItem[];
  refundAmount?: string;
  refundMethod?: string;
  supportUrl?: string;
}

// refund-confirmation.tsx
interface RefundConfirmationProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber: string;
  refundAmount: string;
  refundMethod: string;
  cardLast4?: string;
  estimatedDays?: number;
  items?: LineItem[];
}

// password-reset.tsx
interface PasswordResetProps extends BaseTemplateProps {
  recipientName?: string;
  resetUrl: string;
  expiryMinutes?: number;
  recipientType?: "customer" | "admin";
}

// welcome.tsx
interface WelcomeProps extends BaseTemplateProps {
  customerName?: string;
  shopUrl?: string;
  featuredCollections?: Array<{ name: string; href: string; imageUrl?: string }>;
}

// abandoned-cart.tsx
interface AbandonedCartProps extends BaseTemplateProps {
  customerName?: string;
  items: CommerceLineItem[];
  cartTotal: string;
  cartUrl: string;
  abandonedAt?: string;
}

// invoice-ready.tsx
interface InvoiceReadyProps extends BaseTemplateProps {
  customerName?: string;
  invoiceNumber: string;
  orderNumber: string;
  total: string;
  invoiceUrl: string;
}

// payment-failed.tsx
interface PaymentFailedProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber?: string;
  amount: string;
  paymentMethod: string;
  cardLast4?: string;
  retryUrl: string;
  failureReason?: string;
}

// return-requested.tsx
interface ReturnRequestedProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber: string;
  returnId: string;
  items: CommerceLineItem[];
  returnReason?: string;
  returnStatusUrl?: string;
}

// return-status.tsx
interface ReturnStatusProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber: string;
  returnId: string;
  status: "approved" | "declined" | "received" | "refunded";
  items: CommerceLineItem[];
  refundAmount?: string;
  declineReason?: string;
  returnLabel?: { url: string; carrier: string };
}

// gift-card-delivery.tsx
interface GiftCardDeliveryProps extends BaseTemplateProps {
  recipientName?: string;
  senderName: string;
  amount: string;
  code: string;
  message?: string;
  redeemUrl: string;
  expiresAt?: string;
}

// quote-request-received.tsx
interface QuoteRequestReceivedProps extends BaseTemplateProps {
  customerName?: string;
  quoteId: string;
  items: LineItem[];
  message?: string;
}

// quote-sent.tsx
interface QuoteSentProps extends BaseTemplateProps {
  customerName?: string;
  quoteId: string;
  items: LineItem[];
  total: string;
  expiresAt: string;
  quoteUrl: string;
}

// quote-status.tsx
interface QuoteStatusProps extends BaseTemplateProps {
  customerName?: string;
  quoteId: string;
  status: "accepted" | "rejected" | "expired";
  items: LineItem[];
  total?: string;
}

// review-request.tsx
interface ReviewRequestProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber: string;
  items: Array<CommerceLineItem & { reviewUrl: string }>;
  daysPostDelivery?: number;
}

// invite-user.tsx
interface InviteUserProps extends BaseTemplateProps {
  inviterName?: string;
  inviteUrl: string;
  role?: string;
  expiryDays?: number;
}

// email-verification.tsx
interface EmailVerificationProps extends BaseTemplateProps {
  customerName?: string;
  verificationUrl: string;
  expiryMinutes?: number;
}

// restock-notification.tsx (customer-facing "back in stock")
interface RestockNotificationProps extends BaseTemplateProps {
  customerName?: string;
  items: Array<CommerceLineItem & { productUrl: string }>;
  shopUrl?: string;
}
```

### Admin-facing templates

```typescript
// admin-new-order.tsx
interface AdminNewOrderProps extends BaseTemplateProps {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: string;
  items: CommerceLineItem[];
  shippingAddress: Address;
  adminOrderUrl: string;
}

// admin-low-stock.tsx
interface AdminLowStockProps extends BaseTemplateProps {
  items: Array<{
    name: string;
    sku: string;
    currentStock: number;
    threshold: number;
    productUrl: string;
  }>;
  adminInventoryUrl: string;
}

// admin-daily-digest.tsx
interface AdminDailyDigestProps extends BaseTemplateProps {
  date: string;
  totalOrders: number;
  totalRevenue: string;
  newCustomers: number;
  topProducts: Array<{ name: string; quantity: number; revenue: string }>;
  lowStockCount?: number;
  adminDashboardUrl: string;
}
```

---

## 5. EmailBrandConfig

```typescript
export interface EmailBrandConfig {
  companyName: string;
  logoUrl: string;
  logoAlt?: string;
  supportEmail: string;
  websiteUrl: string;
  appUrl?: string;
  address?: string;
  copyrightYear?: number;
  socialLinks?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    github?: string;
  };
  legalLinks?: {
    terms?: string;
    privacy?: string;
    unsubscribe?: string;
    preferences?: string;
    cookies?: string;
    contact?: string;
  };
  navLinks?: Array<{ label: string; href: string }>;
}

export const defaultEmailConfig: EmailBrandConfig = {
  companyName: "CrowCommerce",
  logoUrl: "",
  logoAlt: "CrowCommerce",
  supportEmail: "support@crowcommerce.com",
  websiteUrl: "https://crowcommerce.com",
  appUrl: "https://crowcommerce.com/account",
  address: "",
  copyrightYear: new Date().getFullYear(),
  socialLinks: {
    twitter: "https://x.com/crowcommerce",
  },
  legalLinks: {
    terms: "https://crowcommerce.com/terms",
    privacy: "https://crowcommerce.com/privacy",
  },
};

export function getEmailConfig(overrides?: Partial<EmailBrandConfig>): EmailBrandConfig {
  return {
    ...defaultEmailConfig,
    ...overrides,
    socialLinks: { ...defaultEmailConfig.socialLinks, ...overrides?.socialLinks },
    legalLinks: { ...defaultEmailConfig.legalLinks, ...overrides?.legalLinks },
  };
}
```

**Logo behavior:** The `Logo` sub-component in header/footer renders an `<Img>` if `logoUrl` is set, falls back to a text wordmark using `config.companyName`. Never a hardcoded string literal. Store owners rebrand by editing `email-config.ts` — zero template files touched.

---

## 6. Design Decisions Log

| Decision | Rationale |
|----------|-----------|
| Approach B (lean extraction) over direct fork | 15 semantic tokens vs 300+ eliminates dead code, keeps token file auditable |
| Drop `PricingTable` component | SaaS-specific, no ecommerce use case |
| Keep `LineItems` + `PaymentDetails` as-is | Already perfect for commerce receipts and order confirmations |
| Add `CommerceLineItem` extending `LineItem` | Avoids scattering `& { imageUrl?: string }` across individual template interfaces |
| Pre-formatted money strings (not numbers) | Templates stay dumb and testable; formatting is the caller's responsibility |
| `recipientType` on password-reset | Allows copy differentiation between customer and admin flows without separate templates |
| Error/warning/success colors unchanged | Status colors are universal; no reason to change with brand color |
| `brand-400` set to `#818cf8` (not `#6366f1`) | Avoids brand-400/brand-500 collision in TailwindUI's indigo scale |
| `theme.ts` unchanged from UntitledUI | Typography, spacing, radii, and shadows are identical between systems — zero diff needed |
| `LeftAligned` as default header/footer variant | Cleanest transactional email layout; marketing templates (welcome, review-request) may use `CenterAligned` |
| Added `email-verification.tsx` and `restock-notification.tsx` | Both referenced as launch-blocking/v1-carried in v2 plan but were missing from initial template list |

---

## 7. Preview Data & Development

Each template should export preview props for the `react-email dev` server:

```tsx
// At the bottom of each template file
OrderConfirmation.PreviewProps = {
  customerName: "Jane Smith",
  orderNumber: "CC-1042",
  orderDate: "March 13, 2026",
  items: [{ name: "Leather Tote Bag", quantity: 1, price: "$148.00", variant: "Tan", imageUrl: "..." }],
  subtotal: "$148.00",
  shipping: "$9.99",
  tax: "$13.32",
  total: "$171.31",
  paymentMethod: "Visa",
  cardLast4: "4242",
  shippingAddress: { name: "Jane Smith", line1: "123 Main St", city: "Portland", state: "OR", postalCode: "97201", country: "US" },
} satisfies OrderConfirmationProps;
```

This enables visual verification during development without a running Medusa backend.

---

## 8. Alignment with v2 Plan

This spec supersedes the v2 plan's directory structure (which had `components/` without underscore prefix and `tokens.ts` as a single file). The v2 plan's directory tree should be updated to match Section 3 of this spec. Specifically:

| v2 plan | This spec | Rationale |
|---------|-----------|-----------|
| `components/` | `_components/` | `_` prefix follows react-email convention (excluded from dev server route listing) |
| `tokens.ts` (single file) | `_theme/` (3-file directory) | Mirrors UntitledUI's actual structure, keeps primitives separate from semantic mappings |
| (not present) | `_config/` | Houses `EmailBrandConfig`, separated from templates |
| (not present) | `_commerce/` | Ecommerce-specific shared components |
| (not present) | `utils/` | `cx()` utility |

All other v2 plan architecture (subscribers, workflows, scheduled jobs, Medusa integration) remains authoritative and unchanged
