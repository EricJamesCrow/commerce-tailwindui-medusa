# Email Foundation (Stack 1) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the email notification infrastructure — Resend module provider, TailwindUI-themed shared components, and one end-to-end template (order confirmation) proving the system works.

**Architecture:** Medusa v2 notification provider pattern (AbstractNotificationProviderService) → react-email templates with UntitledUI component structure → TailwindUI design tokens. Templates are pure React components rendered to HTML via @react-email/render, sent through Resend API.

**Tech Stack:** Medusa v2.13, Resend, react-email (Html/Head/Body/Container/Section/Row/Column/Text/Button/Img/Hr/Preview), @react-email/tailwind, TypeScript

**Spec:** `docs/email-template-architecture.md`
**Source templates:** `/Users/itsjusteric/Developer/smartpockets/packages/email/`

**Note:** The spec lists `@react-email/components` and `@react-email/tailwind` as dependencies but omits `@react-email/render`, which is required by the Resend service to convert JSX to HTML. This plan includes it in the install step.

---

## Chunk 1: PR 1 — Resend Notification Module Provider

### Task 1: Install dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install email packages in backend workspace**

Run from repo root:

```bash
cd backend && bun add resend @react-email/components @react-email/tailwind @react-email/render && bun add -d react-email
```

- [ ] **Step 2: Verify installation**

Run: `cd backend && cat package.json | grep -E "resend|react-email"`

Expected: All 4 packages listed in dependencies/devDependencies.

- [ ] **Step 3: Commit**

```bash
gt create -m "chore(email): install resend and react-email dependencies"
```

---

### Task 2: Create Resend notification service

**Files:**
- Create: `backend/src/modules/resend/service.ts`

- [ ] **Step 1: Create the service file**

```typescript
// backend/src/modules/resend/service.ts
import {
  AbstractNotificationProviderService,
} from "@medusajs/framework/utils"
import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import { Resend } from "resend"
import { render } from "@react-email/render"

type ResendOptions = {
  api_key: string
  from: string
}

type InjectedDependencies = {
  logger: Logger
}

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"
  private resendClient: Resend
  private options: ResendOptions
  private logger: Logger

  // Template map — templates are registered here as they're built.
  // Each key matches the `template` string passed via createNotifications().
  private templates: Record<string, React.FC<any>> = {}

  constructor(
    { logger }: InjectedDependencies,
    options: ResendOptions
  ) {
    super()
    this.resendClient = new Resend(options.api_key)
    this.options = options
    this.logger = logger
  }

  static validateOptions(options: Record<string, any>) {
    if (!options.api_key) {
      throw new Error("Resend api_key is required in provider options")
    }
    if (!options.from) {
      throw new Error("Resend from email is required in provider options")
    }
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const templateId = notification.template
    const Template = this.templates[templateId]

    if (!Template) {
      this.logger.error(
        `Email template "${templateId}" not found. ` +
        `Available: ${Object.keys(this.templates).join(", ") || "(none)"}`
      )
      return {}
    }

    const html = await render(Template(notification.data || {}))

    const subject =
      (notification.data as Record<string, any>)?.subject ??
      templateId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

    const { data, error } = await this.resendClient.emails.send({
      from: this.options.from,
      to: [notification.to],
      subject,
      html,
    })

    if (error || !data) {
      this.logger.error("Failed to send email", error ?? "unknown error")
      return {}
    }

    return { id: data.id }
  }
}

export default ResendNotificationProviderService
```

- [ ] **Step 2: Verify file exists**

Run: `ls backend/src/modules/resend/service.ts`

Expected: File listed.

---

### Task 3: Create module provider index

**Files:**
- Create: `backend/src/modules/resend/index.ts`

- [ ] **Step 1: Create the module provider definition**

```typescript
// backend/src/modules/resend/index.ts
import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import ResendNotificationProviderService from "./service"

export default ModuleProvider(Modules.NOTIFICATION, {
  services: [ResendNotificationProviderService],
})
```

---

### Task 4: Register provider in medusa-config.ts

**Files:**
- Modify: `backend/medusa-config.ts`

- [ ] **Step 1: Add Resend notification provider to modules array**

Add this entry to the `modules` array in `medusa-config.ts`, after the existing module entries and before the Stripe conditional block:

```typescript
    // Resend email notification provider (conditional on RESEND_API_KEY)
    ...(process.env.RESEND_API_KEY
      ? [
          {
            resolve: "@medusajs/medusa/notification",
            options: {
              providers: [
                {
                  resolve: "./src/modules/resend",
                  id: "resend",
                  options: {
                    channels: ["email"],
                    api_key: process.env.RESEND_API_KEY,
                    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
                  },
                },
              ],
            },
          },
        ]
      : []),
```

- [ ] **Step 2: Add env vars to .env.template**

Append to `backend/.env.template`:

```
# Resend (email notifications)
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev
```

---

### Task 5: Build verification

- [ ] **Step 1: Run typecheck**

Run: `cd backend && bun run typecheck`

Expected: No errors. If there are type errors in the Resend service, fix them before proceeding.

- [ ] **Step 2: Run build**

Run: `cd backend && bun run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/resend/service.ts backend/src/modules/resend/index.ts backend/medusa-config.ts backend/.env.template
git commit -m "$(cat <<'EOF'
feat(notification): add Resend module provider

Implements AbstractNotificationProviderService with template map pattern.
Templates will be registered as they're built in subsequent PRs.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: PR 2 — Theme System + Shared Email Components

### Task 6: Create theme — colors.ts (lean primitive palette)

**Files:**
- Create: `backend/src/modules/resend/templates/_theme/colors.ts`

Per the spec's Approach B (lean extraction), write ~60 primitives instead of UntitledUI's 500+. Only include colors that the 15 semantic tokens reference.

- [ ] **Step 1: Write the lean primitive color palette**

```typescript
// backend/src/modules/resend/templates/_theme/colors.ts
/**
 * Lean primitive color palette for CrowCommerce email templates.
 * ~60 values (vs UntitledUI's 500+). Only includes colors referenced
 * by the 15 semantic tokens email templates actually use.
 *
 * Brand: TailwindUI indigo scale
 * Gray: TailwindUI gray scale
 * Status: UntitledUI error/warning/success (unchanged)
 */

export const primitiveColors = {
  white: "#ffffff",
  black: "#000000",

  // Gray — TailwindUI default gray
  "gray-25": "#fcfcfd",
  "gray-50": "#f9fafb",
  "gray-100": "#f3f4f6",
  "gray-200": "#e5e7eb",
  "gray-300": "#d1d5db",
  "gray-400": "#9ca3af",
  "gray-500": "#6b7280",
  "gray-600": "#4b5563",
  "gray-700": "#374151",
  "gray-800": "#1f2937",
  "gray-900": "#111827",
  "gray-950": "#030712",

  // Brand — TailwindUI indigo
  "brand-25": "#eef2ff",
  "brand-50": "#e0e7ff",
  "brand-100": "#c7d2fe",
  "brand-200": "#a5b4fc",
  "brand-300": "#818cf8",
  "brand-400": "#818cf8",
  "brand-500": "#6366f1",
  "brand-600": "#4f46e5",
  "brand-700": "#4338ca",
  "brand-800": "#3730a3",
  "brand-900": "#312e81",
  "brand-950": "#1e1b4b",

  // Error — unchanged from UntitledUI
  "error-50": "#fef3f2",
  "error-100": "#fee4e2",
  "error-300": "#fda29b",
  "error-500": "#f04438",
  "error-600": "#d92d20",
  "error-700": "#b42318",

  // Warning — unchanged from UntitledUI
  "warning-50": "#fffceb",
  "warning-100": "#fef0c7",
  "warning-500": "#f79009",
  "warning-600": "#dc6803",

  // Success — unchanged from UntitledUI
  "success-50": "#ecfdf3",
  "success-100": "#dcfae6",
  "success-500": "#17b26a",
  "success-600": "#079455",
};
```

---

### Task 7: Create theme — theme-colors.ts (lean semantic tokens)

**Files:**
- Create: `backend/src/modules/resend/templates/_theme/theme-colors.ts`

Per the spec: 15 semantic tokens, not UntitledUI's 300+. Only map what templates actually reference.

- [ ] **Step 1: Write the lean semantic token mapping**

```typescript
// backend/src/modules/resend/templates/_theme/theme-colors.ts
import { primitiveColors } from "./colors";

export const getThemeColors = (theme: "light" | "dark" = "light") => {
  // Dark mode uses the same structure with inverted values.
  // For now, only light mode is defined — dark mode can be added later.
  const isLight = theme === "light";

  return {
    backgroundColor: {
      primary: isLight ? primitiveColors.white : primitiveColors["gray-900"],
      secondary: {
        DEFAULT: isLight ? primitiveColors["gray-50"] : primitiveColors["gray-800"],
      },
      "brand-solid": primitiveColors["brand-600"],
      "brand-secondary": primitiveColors["brand-100"],
      "error-secondary": primitiveColors["error-100"],
      "success-primary": primitiveColors["success-50"],
      "warning-primary": primitiveColors["warning-50"],
    },
    textColor: {
      primary: {
        DEFAULT: isLight ? primitiveColors["gray-900"] : primitiveColors["gray-50"],
      },
      secondary: isLight ? primitiveColors["gray-700"] : primitiveColors["gray-200"],
      tertiary: isLight ? primitiveColors["gray-600"] : primitiveColors["gray-300"],
      brand: {
        secondary: primitiveColors["brand-700"],
      },
      error: {
        primary: primitiveColors["error-600"],
      },
      warning: {
        primary: primitiveColors["warning-600"],
      },
      success: {
        primary: primitiveColors["success-600"],
      },
    },
    borderColor: {
      primary: {
        DEFAULT: isLight ? primitiveColors["gray-300"] : primitiveColors["gray-600"],
      },
      secondary: isLight ? primitiveColors["gray-200"] : primitiveColors["gray-700"],
      brand: {
        DEFAULT: primitiveColors["brand-500"],
      },
    },
    colors: {
      ...primitiveColors,
      button: {
        primary: {
          fg: primitiveColors.white,
          bg: primitiveColors["brand-600"],
        },
        secondary: {
          fg: isLight ? primitiveColors["gray-700"] : primitiveColors["gray-200"],
          bg: isLight ? primitiveColors.white : primitiveColors["gray-800"],
          border: isLight ? primitiveColors["gray-300"] : primitiveColors["gray-600"],
        },
      },
    },
  };
};
```

---

### Task 8: Create theme — theme.ts

**Files:**
- Create: `backend/src/modules/resend/templates/_theme/theme.ts`

- [ ] **Step 1: Copy theme.ts from UntitledUI, update import**

Copy from `/Users/itsjusteric/Developer/smartpockets/packages/email/emails/_theme/theme.ts` to `backend/src/modules/resend/templates/_theme/theme.ts`.

Verify the import at line 1 reads `import { getThemeColors } from "./theme-colors"` — this should already match since we named our file identically.

No other changes needed — spacing, fonts, radii, shadows are identical between systems.

- [ ] **Step 2: Verify lean theme compatibility**

Read the copied `theme.ts` and confirm that `getThemeObject()` simply spreads `getThemeColors(theme)` at the top of the returned object (line 7: `...getThemeColors(theme)`). It does NOT destructure specific keys from it. This means our lean `getThemeColors()` is safe — missing keys simply won't generate Tailwind utilities, and the 15 semantic tokens we defined cover every class used in our shared components and templates. If `theme.ts` ever destructured specific keys (e.g., `const { backgroundColor } = getThemeColors(theme)`), that would need to match our lean structure — but it doesn't.

---

### Task 9: Create utility — cx.ts

**Files:**
- Create: `backend/src/modules/resend/templates/utils/cx.ts`

- [ ] **Step 1: Copy cx.ts verbatim**

```typescript
// backend/src/modules/resend/templates/utils/cx.ts
/**
 * Simple class name utility for email templates.
 * Email templates don't need tailwind-merge, just basic concatenation.
 */
export function cx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
```

---

### Task 10: Create email config

**Files:**
- Create: `backend/src/modules/resend/templates/_config/email-config.ts`

- [ ] **Step 1: Write CrowCommerce email config**

```typescript
// backend/src/modules/resend/templates/_config/email-config.ts
/**
 * Email Brand Configuration
 *
 * This configuration is used across all email templates to maintain
 * consistent branding. Override these values when sending emails
 * by passing a partial config to the template.
 */

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

export function getEmailConfig(
  overrides?: Partial<EmailBrandConfig>
): EmailBrandConfig {
  return {
    ...defaultEmailConfig,
    ...overrides,
    socialLinks: {
      ...defaultEmailConfig.socialLinks,
      ...overrides?.socialLinks,
    },
    legalLinks: {
      ...defaultEmailConfig.legalLinks,
      ...overrides?.legalLinks,
    },
  };
}
```

---

### Task 11: Copy verbatim shared components (5 files)

**Files:**
- Create: `backend/src/modules/resend/templates/_components/tailwind.tsx`
- Create: `backend/src/modules/resend/templates/_components/head.tsx`
- Create: `backend/src/modules/resend/templates/_components/body.tsx`
- Create: `backend/src/modules/resend/templates/_components/text.tsx`
- Create: `backend/src/modules/resend/templates/_components/button.tsx`

- [ ] **Step 1: Copy all 5 files from UntitledUI source**

Copy each file verbatim from `/Users/itsjusteric/Developer/smartpockets/packages/email/emails/_components/` to `backend/src/modules/resend/templates/_components/`:

1. `tailwind.tsx` — No changes. Fix import path: `"../_theme/theme"` instead of `"../_theme/theme"` (should already match).
2. `head.tsx` — No changes.
3. `body.tsx` — No changes.
4. `text.tsx` — No changes.
5. `button.tsx` — No changes.

Verify each file's relative import paths resolve correctly:
- `tailwind.tsx` imports from `../_theme/theme`
- `body.tsx` imports from `../utils/cx`
- `button.tsx` imports from `../utils/cx`
- `text.tsx` imports from `../utils/cx`

---

### Task 12: Copy and adapt header.tsx

**Files:**
- Create: `backend/src/modules/resend/templates/_components/header.tsx`

- [ ] **Step 1: Copy header.tsx from UntitledUI**

Copy from `/Users/itsjusteric/Developer/smartpockets/packages/email/emails/_components/header.tsx`.

- [ ] **Step 2: Apply ALL of the following edits**

**Edit A — Fix Logo component** (around line 9-19 in the source):

Find:
```tsx
const Logo = ({ logoUrl, logoAlt, className }: { logoUrl: string; logoAlt: string; className?: string }) => {
    if (logoUrl) {
        return <Img src={logoUrl} alt={logoAlt} className={className || "h-7 md:h-8"} />;
    }
    return (
        <EmailText style={{ fontSize: "20px", fontWeight: 700, lineHeight: "28px", margin: 0 }}>
            <span style={{ color: "#181d27" }}>Smart</span>
            <span style={{ color: "#099250" }}>Pockets</span>
        </EmailText>
    );
};
```

Replace with:
```tsx
const Logo = ({ logoUrl, logoAlt, companyName, className }: { logoUrl: string; logoAlt: string; companyName?: string; className?: string }) => {
    if (logoUrl) {
        return <Img src={logoUrl} alt={logoAlt} className={className || "h-7 md:h-8"} />;
    }
    return (
        <EmailText style={{ fontSize: "20px", fontWeight: 700, lineHeight: "28px", margin: 0, color: "#111827" }}>
            {companyName || "CrowCommerce"}
        </EmailText>
    );
};
```

**Edit B — Add `companyName` to HeaderProps** (around line 24):

Add `companyName?: string;` to the `HeaderProps` interface.

**Edit C — Thread `companyName` to Logo in ALL 6 variants:**

In each variant function (`LeftAligned`, `LeftAlignedLinks`, `LeftAlignedSocials`, `CenterAligned`, `CenterAlignedLinks`, `CenterAlignedSocials`):

1. Add `companyName = defaultEmailConfig.companyName` to the destructured props
2. Pass `companyName={companyName}` to each `<Logo>` call

Example for `LeftAligned`:
```tsx
export const LeftAligned = ({
    logoUrl = defaultEmailConfig.logoUrl,
    logoAlt = defaultEmailConfig.logoAlt || "CrowCommerce",
    companyName = defaultEmailConfig.companyName,
}: HeaderProps = {}) => {
    return (
        <Container align="left" className="max-w-full bg-primary p-6">
            <Row>
                <Logo logoUrl={logoUrl} logoAlt={logoAlt} companyName={companyName} />
            </Row>
        </Container>
    );
};
```

Apply the same pattern to all other 5 variants.

**Edit D — Replace all `"SmartPockets"` fallback strings** with `"CrowCommerce"`.

**Edit E — Social icon URLs:** Keep UntitledUI CDN URLs for now (they're public). Add a `// TODO: self-host social icons` comment at the top of the file.

---

### Task 13: Copy and adapt footer.tsx

**Files:**
- Create: `backend/src/modules/resend/templates/_components/footer.tsx`

- [ ] **Step 1: Copy footer.tsx from UntitledUI**

Copy from `/Users/itsjusteric/Developer/smartpockets/packages/email/emails/_components/footer.tsx`.

- [ ] **Step 2: Apply ALL of the following edits (same pattern as header)**

**Edit A — Fix Logo component** (around line 9-19 in the source):

Same replacement as header Task 11 Edit A — add `companyName` prop, remove two-span hardcoded wordmark, update hex color to `#111827`.

**Edit B — Add `companyName` to FooterProps:**

The `FooterProps` interface already has `companyName?: string`. No change needed.

**Edit C — Thread `companyName` to Logo** in variants that render `<Logo>`:

`LeftAligned` and `LeftAlignedActions` variants render `<Logo>`. Add `companyName={companyName}` to each Logo call. The `companyName` prop is already destructured in these variants.

**Edit D — Replace all `"SmartPockets"` fallback strings** with `"CrowCommerce"`.

**Edit E — Social icon URLs:** Same as header — keep UntitledUI CDN URLs, add TODO comment.

---

### Task 14: Copy line-items.tsx

**Files:**
- Create: `backend/src/modules/resend/templates/_components/line-items.tsx`

- [ ] **Step 1: Copy line-items.tsx verbatim**

Copy from `/Users/itsjusteric/Developer/smartpockets/packages/email/emails/_components/line-items.tsx`. No changes needed.

---

### Task 15: Create shared types

**Files:**
- Create: `backend/src/modules/resend/templates/types.ts`

- [ ] **Step 1: Write shared types file**

```typescript
// backend/src/modules/resend/templates/types.ts
import type { EmailBrandConfig } from "./_config/email-config";

export interface BaseTemplateProps {
  theme?: "light" | "dark";
  brandConfig?: Partial<EmailBrandConfig>;
}

// Re-export LineItem from line-items component (UntitledUI's interface, unchanged)
export type { LineItem } from "./_components/line-items";
import type { LineItem } from "./_components/line-items";

/** Extended line item for ecommerce templates needing richer item display */
export interface CommerceLineItem extends LineItem {
  imageUrl?: string;
  variant?: string;
  sku?: string;
}

/** Shipping/billing address */
export interface Address {
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

---

### Task 16: Create commerce components (3 files)

**Files:**
- Create: `backend/src/modules/resend/templates/_commerce/order-summary.tsx`
- Create: `backend/src/modules/resend/templates/_commerce/address-block.tsx`
- Create: `backend/src/modules/resend/templates/_commerce/order-status-badge.tsx`

- [ ] **Step 1: Write OrderSummary component**

```tsx
// backend/src/modules/resend/templates/_commerce/order-summary.tsx
import { Column, Row, Section } from "@react-email/components";
import { Text } from "../_components/text";

export interface OrderSummaryProps {
  subtotal: string;
  shipping: string;
  discount?: string;
  tax?: string;
  total: string;
}

export const OrderSummary = ({
  subtotal,
  shipping,
  discount,
  tax,
  total,
}: OrderSummaryProps) => {
  return (
    <Section className="my-6 rounded-lg border border-solid border-secondary bg-secondary p-4">
      <Row className="py-1">
        <Column className="w-[70%]">
          <Text className="m-0 text-sm text-tertiary">Subtotal</Text>
        </Column>
        <Column className="w-[30%]" align="right">
          <Text className="m-0 text-sm text-primary">{subtotal}</Text>
        </Column>
      </Row>
      <Row className="py-1">
        <Column className="w-[70%]">
          <Text className="m-0 text-sm text-tertiary">Shipping</Text>
        </Column>
        <Column className="w-[30%]" align="right">
          <Text className="m-0 text-sm text-primary">{shipping}</Text>
        </Column>
      </Row>
      {discount && (
        <Row className="py-1">
          <Column className="w-[70%]">
            <Text className="m-0 text-sm text-tertiary">Discount</Text>
          </Column>
          <Column className="w-[30%]" align="right">
            <Text className="m-0 text-sm text-success-primary">-{discount}</Text>
          </Column>
        </Row>
      )}
      {tax && (
        <Row className="py-1">
          <Column className="w-[70%]">
            <Text className="m-0 text-sm text-tertiary">Tax</Text>
          </Column>
          <Column className="w-[30%]" align="right">
            <Text className="m-0 text-sm text-primary">{tax}</Text>
          </Column>
        </Row>
      )}
      <Row className="border-t border-solid border-secondary pt-3 mt-2">
        <Column className="w-[70%]">
          <Text className="m-0 text-md font-semibold text-primary">Total</Text>
        </Column>
        <Column className="w-[30%]" align="right">
          <Text className="m-0 text-md font-semibold text-primary">{total}</Text>
        </Column>
      </Row>
    </Section>
  );
};
```

- [ ] **Step 2: Write AddressBlock component**

```tsx
// backend/src/modules/resend/templates/_commerce/address-block.tsx
import { Section } from "@react-email/components";
import { Text } from "../_components/text";
import type { Address } from "../types";

export interface AddressBlockProps {
  label: string;
  address: Address;
}

export const AddressBlock = ({ label, address }: AddressBlockProps) => {
  return (
    <Section className="my-4">
      <Text className="m-0 mb-1 text-xs font-medium uppercase text-tertiary">
        {label}
      </Text>
      <Text className="m-0 text-sm text-primary">
        {address.name}
        <br />
        {address.line1}
        {address.line2 && (
          <>
            <br />
            {address.line2}
          </>
        )}
        <br />
        {address.city}
        {address.state && `, ${address.state}`} {address.postalCode}
        <br />
        {address.country}
        {address.phone && (
          <>
            <br />
            {address.phone}
          </>
        )}
      </Text>
    </Section>
  );
};
```

- [ ] **Step 3: Write OrderStatusBadge component**

```tsx
// backend/src/modules/resend/templates/_commerce/order-status-badge.tsx
import { Section } from "@react-email/components";
import { Text } from "../_components/text";
import { cx } from "../utils/cx";

type OrderStatus = "confirmed" | "shipped" | "delivered" | "canceled";

const statusStyles: Record<OrderStatus, string> = {
  confirmed: "bg-brand-secondary text-brand-secondary",
  shipped: "bg-brand-secondary text-brand-secondary",
  delivered: "bg-success-primary text-success-primary",
  canceled: "bg-error-secondary text-error-primary",
};

const statusLabels: Record<OrderStatus, string> = {
  confirmed: "Order Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  canceled: "Canceled",
};

export interface OrderStatusBadgeProps {
  status: OrderStatus;
}

export const OrderStatusBadge = ({ status }: OrderStatusBadgeProps) => {
  return (
    <Section>
      <Text
        className={cx(
          "m-0 inline-block rounded-full px-3 py-1 text-xs font-semibold",
          statusStyles[status]
        )}
      >
        {statusLabels[status]}
      </Text>
    </Section>
  );
};
```

---

### Task 17: Build verification + commit

- [ ] **Step 1: Run typecheck**

Run: `cd backend && bun run typecheck`

Expected: No errors. Fix any import path issues.

- [ ] **Step 2: Commit all theme + component files**

```bash
git add backend/src/modules/resend/templates/
git commit -m "$(cat <<'EOF'
feat(email): add TailwindUI-themed email components based on UntitledUI

- Theme system: indigo brand + TailwindUI gray primitives, 15 semantic tokens
- 8 shared components copied from UntitledUI (header/footer adapted for CrowCommerce)
- 3 new commerce components: OrderSummary, AddressBlock, OrderStatusBadge
- EmailBrandConfig with getEmailConfig() deep merge helper
- Shared types: BaseTemplateProps, CommerceLineItem, Address

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 3: PR 3 — Order Confirmation Template (End-to-End Proof)

### Task 18: Create order confirmation template

**Files:**
- Create: `backend/src/modules/resend/templates/order-confirmation.tsx`

- [ ] **Step 1: Write the order confirmation template**

```tsx
// backend/src/modules/resend/templates/order-confirmation.tsx
import { Container, Html, Preview, Row, Section, Column } from "@react-email/components";
import { Body } from "./_components/body";
import { Button } from "./_components/button";
import { LeftAligned as Footer } from "./_components/footer";
import { Head } from "./_components/head";
import { LeftAligned as Header } from "./_components/header";
import { Tailwind } from "./_components/tailwind";
import { Text } from "./_components/text";
import { OrderSummary } from "./_commerce/order-summary";
import { AddressBlock } from "./_commerce/address-block";
import { defaultEmailConfig, type EmailBrandConfig } from "./_config/email-config";
import type { CommerceLineItem, Address, BaseTemplateProps } from "./types";

export interface OrderConfirmationProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber: string;
  orderDate: string;
  items: CommerceLineItem[];
  subtotal: string;
  shipping: string;
  tax?: string;
  discount?: string;
  total: string;
  paymentMethod: string;
  cardLast4?: string;
  shippingAddress: Address;
  billingAddress?: Address;
  orderStatusUrl?: string;
}

export const OrderConfirmation = ({
  theme,
  customerName,
  orderNumber,
  orderDate,
  items,
  subtotal,
  shipping,
  tax,
  total,
  paymentMethod,
  cardLast4,
  shippingAddress,
  billingAddress,
  orderStatusUrl,
  discount,
  brandConfig,
}: OrderConfirmationProps) => {
  const config = { ...defaultEmailConfig, ...brandConfig };
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>
          Order #{orderNumber} confirmed - {total}
        </Preview>
        <Body>
          <Container align="center" className="w-full max-w-160 bg-primary md:p-8">
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  Order Confirmed
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  {greeting}
                  <br />
                  <br />
                  Thank you for your order! We've received your order and
                  will begin processing it shortly.
                </Text>
              </Row>

              <Row className="mb-2">
                <Column>
                  <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                    Order Number
                  </Text>
                  <Text className="m-0 mt-1 text-sm font-semibold text-primary">
                    #{orderNumber}
                  </Text>
                </Column>
                <Column align="right">
                  <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                    Order Date
                  </Text>
                  <Text className="m-0 mt-1 text-sm text-primary">
                    {orderDate}
                  </Text>
                </Column>
              </Row>

              {/* Item list */}
              <Section className="my-6 rounded-lg border border-solid border-secondary">
                <Row className="border-b border-solid border-secondary bg-secondary px-4 py-3">
                  <Column className="w-[50%]">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Item
                    </Text>
                  </Column>
                  <Column className="w-[15%]" align="center">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Qty
                    </Text>
                  </Column>
                  <Column className="w-[20%]" align="right">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Price
                    </Text>
                  </Column>
                </Row>
                {items.map((item, index) => (
                  <Row
                    key={index}
                    className={`px-4 py-3 ${
                      index < items.length - 1
                        ? "border-b border-solid border-secondary"
                        : ""
                    }`}
                  >
                    <Column className="w-[50%]">
                      <Text className="m-0 text-sm text-primary">
                        {item.name}
                      </Text>
                      {item.variant && (
                        <Text className="m-0 text-xs text-tertiary">
                          {item.variant}
                        </Text>
                      )}
                    </Column>
                    <Column className="w-[15%]" align="center">
                      <Text className="m-0 text-sm text-tertiary">
                        {item.quantity || 1}
                      </Text>
                    </Column>
                    <Column className="w-[20%]" align="right">
                      <Text className="m-0 text-sm text-primary">
                        {item.price}
                      </Text>
                    </Column>
                  </Row>
                ))}
              </Section>

              <OrderSummary
                subtotal={subtotal}
                shipping={shipping}
                discount={discount}
                tax={tax}
                total={total}
              />

              {/* Payment info */}
              <Section className="my-6 rounded-lg border border-solid border-secondary bg-secondary p-4">
                <Row>
                  <Column>
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Payment Method
                    </Text>
                    <Text className="m-0 mt-1 text-sm text-primary">
                      {paymentMethod}
                      {cardLast4 && ` ending in ${cardLast4}`}
                    </Text>
                  </Column>
                </Row>
              </Section>

              <Row>
                <Column className="w-1/2">
                  <AddressBlock label="Shipping Address" address={shippingAddress} />
                </Column>
                {billingAddress && (
                  <Column className="w-1/2">
                    <AddressBlock label="Billing Address" address={billingAddress} />
                  </Column>
                )}
              </Row>

              {orderStatusUrl && (
                <Row className="mt-6 mb-6">
                  <Button href={orderStatusUrl}>
                    <Text className="text-md font-semibold">View your order</Text>
                  </Button>
                </Row>
              )}

              <Row>
                <Text className="text-md text-tertiary">
                  If you have any questions, contact us at{" "}
                  <a
                    href={`mailto:${config.supportEmail}`}
                    className="text-brand-secondary"
                  >
                    {config.supportEmail}
                  </a>
                  .
                  <br />
                  <br />
                  Thanks,
                  <br />
                  The {config.companyName} team
                </Text>
              </Row>
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
  );
};

export default OrderConfirmation;
```

---

### Task 19: Register template in Resend service

**Files:**
- Modify: `backend/src/modules/resend/service.ts`

- [ ] **Step 1: Import and register the order confirmation template**

Add to the top of `service.ts`:

```typescript
import { OrderConfirmation } from "./templates/order-confirmation"
```

Update the `templates` property initialization:

```typescript
private templates: Record<string, React.FC<any>> = {
  "order-confirmation": OrderConfirmation,
}
```

---

### Task 20: Create order-placed subscriber

**Files:**
- Create: `backend/src/subscribers/order-placed.ts`

**Field names verified against Medusa v2 API schema (AdminOrderLineItem):**
- Item fields: `product_title`, `variant_title`, `thumbnail`, `unit_price`, `quantity` — flat properties on OrderLineItem (NOT nested like `product.title`)
- Address fields: `first_name`, `last_name`, `address_1`, `address_2`, `city`, `province`, `postal_code`, `country_code`, `phone`
- Order totals: `item_total`, `shipping_total`, `tax_total`, `discount_total`, `total`

- [ ] **Step 1: Write the subscriber**

```typescript
// backend/src/subscribers/order-placed.ts
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve("query")
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve("logger")

  try {
  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "created_at",
      "currency_code",
      "items.id",
      "items.title",
      "items.product_title",
      "items.variant_title",
      "items.quantity",
      "items.unit_price",
      "items.thumbnail",
      "shipping_address.*",
      "billing_address.*",
      "item_total",
      "shipping_total",
      "tax_total",
      "discount_total",
      "total",
    ],
    filters: { id: data.id },
  })

  if (!order?.email) {
    logger.warn(
      `Order ${data.id} has no email address, skipping confirmation email`
    )
    return
  }

  const currencyFormatter = new Intl.NumberFormat([], {
    style: "currency",
    currency: order.currency_code || "USD",
    currencyDisplay: "narrowSymbol",
  })

  const formatMoney = (amount: number) => currencyFormatter.format(amount)

  const items = (order.items || []).map((item: any) => ({
    name: item.product_title || item.title,
    variant: item.variant_title || undefined,
    quantity: item.quantity,
    price: formatMoney(item.unit_price * item.quantity),
    imageUrl: item.thumbnail || undefined,
  }))

  const shippingAddress = order.shipping_address
    ? {
        name: `${order.shipping_address.first_name || ""} ${order.shipping_address.last_name || ""}`.trim(),
        line1: order.shipping_address.address_1 || "",
        line2: order.shipping_address.address_2 || undefined,
        city: order.shipping_address.city || "",
        state: order.shipping_address.province || undefined,
        postalCode: order.shipping_address.postal_code || "",
        country: order.shipping_address.country_code?.toUpperCase() || "",
        phone: order.shipping_address.phone || undefined,
      }
    : {
        name: "",
        line1: "",
        city: "",
        postalCode: "",
        country: "",
      }

  const orderDate = new Date(order.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const storefrontUrl = process.env.STORE_CORS?.split(",")[0] || "http://localhost:3000"

  await notificationModuleService.createNotifications({
    to: order.email,
    channel: "email",
    template: "order-confirmation",
    data: {
      subject: `Order Confirmed - #${order.display_id || order.id}`,
      customerName: order.shipping_address?.first_name || undefined,
      orderNumber: String(order.display_id || order.id),
      orderDate,
      items,
      subtotal: formatMoney(order.item_total || 0),
      shipping: formatMoney(order.shipping_total || 0),
      tax: order.tax_total ? formatMoney(order.tax_total) : undefined,
      discount: order.discount_total ? formatMoney(order.discount_total) : undefined,
      total: formatMoney(order.total || 0),
      paymentMethod: "Card",
      shippingAddress,
      orderStatusUrl: `${storefrontUrl}/account/orders/${order.id}`,
    },
  })

  logger.info(`Order confirmation email sent for order ${order.id}`)
  } catch (error) {
    logger.error(`Failed to send order confirmation email for order ${data.id}`, error)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
```

---

### Task 21: Build verification + commit

- [ ] **Step 1: Run typecheck**

Run: `cd backend && bun run typecheck`

Expected: No errors.

- [ ] **Step 2: Run build**

Run: `cd backend && bun run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/resend/templates/order-confirmation.tsx backend/src/modules/resend/service.ts backend/src/subscribers/order-placed.ts
git commit -m "$(cat <<'EOF'
feat(email): add order confirmation template and subscriber

- OrderConfirmation template with items table, order summary, address blocks
- Subscriber on order.placed that fetches order data and sends via Resend
- Template registered in Resend service template map

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 22: End-to-end verification

- [ ] **Step 1: Start dev server**

Run: `cd backend && bun run dev`

Expected: Server starts on http://localhost:9000 without errors. If RESEND_API_KEY is not set, the Resend provider will not be registered (conditional in medusa-config.ts) — that's fine for dev.

- [ ] **Step 2: Test email flow (when Resend API key is configured)**

1. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `backend/.env`
2. Restart dev server
3. Place a test order via storefront or admin
4. Check Resend dashboard for the sent email
5. Verify the email renders with indigo brand colors, Inter font, and CrowCommerce branding

---

## Summary

| PR | Graphite command | What it delivers |
|----|-----------------|-----------------|
| PR 1 | `gt create -m "feat(notification): add Resend module provider"` | Resend service + module registration |
| PR 2 | `gt create -m "feat(email): add TailwindUI-themed email components"` | Theme system + 11 shared components + types |
| PR 3 | `gt create -m "feat(email): add order confirmation template and subscriber"` | First template + subscriber proving the system works end-to-end |

All subsequent template PRs (Stacks 2-7 from the v2 plan) follow the same pattern: write template → register in service map → create subscriber/workflow → commit.
