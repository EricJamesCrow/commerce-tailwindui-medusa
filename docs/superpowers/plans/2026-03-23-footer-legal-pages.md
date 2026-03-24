# Footer Restructure & Legal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the footer into Products/Company/Legal columns and add five legal policy pages with a shared template component.

**Architecture:** Footer switches from Medusa menu-driven to a static config for Company and Legal columns (Products stays dynamic from Medusa collections). Five legal pages use a shared `PolicyPage` server component based on TailwindPlus "Centered" Content Section, with placeholder content sourced from a typed config file.

**Tech Stack:** Next.js 16 (App Router, Server Components), TailwindCSS + `@tailwindcss/typography` (already installed), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-23-footer-legal-pages-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `storefront/lib/constants/footer.ts` | Create | Static footer link config (Company + Legal columns) |
| `storefront/components/layout/footer/footer-navigation.tsx` | Modify | Use config for Company/Legal, keep Medusa for Products |
| `storefront/components/layout/footer/index.tsx` | Modify | Update skeleton column label widths |
| `storefront/components/legal/policy-page.tsx` | Create | Shared legal page template component |
| `storefront/lib/constants/legal-content.ts` | Create | Typed placeholder content for all 5 policies |
| `storefront/app/privacy-policy/page.tsx` | Create | Privacy Policy route |
| `storefront/app/terms-of-service/page.tsx` | Create | Terms of Service route |
| `storefront/app/return-policy/page.tsx` | Create | Return Policy route |
| `storefront/app/shipping-policy/page.tsx` | Create | Shipping Policy route |
| `storefront/app/cookie-policy/page.tsx` | Create | Cookie Policy route |
| `storefront/lib/utils.ts` | Modify | Remove `transformMenuToFooterNav` |
| `storefront/lib/medusa/index.ts` | Modify | Remove `getMenu` function |
| `SETUP.md` | Modify | Add Legal Pages documentation section |

---

### Task 1: Create footer config

**Files:**
- Create: `storefront/lib/constants/footer.ts`

- [ ] **Step 1: Create the footer config file**

```typescript
// storefront/lib/constants/footer.ts

type FooterLink = { name: string; href: string };

type FooterConfig = {
  company: FooterLink[];
  legal: FooterLink[];
};

export const FOOTER_CONFIG: FooterConfig = {
  company: [
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
    { name: "FAQ", href: "/faq" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy-policy" },
    { name: "Terms of Service", href: "/terms-of-service" },
    { name: "Return Policy", href: "/return-policy" },
    { name: "Shipping Policy", href: "/shipping-policy" },
    { name: "Cookie Policy", href: "/cookie-policy" },
  ],
};
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd storefront && bunx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors related to `footer.ts`

- [ ] **Step 3: Commit**

```bash
git add storefront/lib/constants/footer.ts
git commit -m "feat(storefront): add footer link config for Company and Legal columns"
```

---

### Task 2: Refactor footer navigation component

**Files:**
- Modify: `storefront/components/layout/footer/footer-navigation.tsx`

- [ ] **Step 1: Rewrite footer-navigation.tsx**

Replace the entire file contents. The key changes:
- Remove `getMenu` import and calls
- Remove `transformMenuToFooterNav` import
- Import `FOOTER_CONFIG` from `lib/constants/footer`
- Company column: render from `FOOTER_CONFIG.company`
- Third column: rename from "Customer Service" to "Legal", render from `FOOTER_CONFIG.legal`
- Products column: unchanged (still uses `getCollections()` + `transformCollectionsToFooterProducts`)

```typescript
import { getCollections } from "lib/medusa";
import { transformCollectionsToFooterProducts } from "lib/utils";
import { FOOTER_CONFIG } from "lib/constants/footer";
import Link from "next/link";

export default async function FooterNavigation() {
  const collections = await getCollections();
  const products = transformCollectionsToFooterProducts(
    collections.slice(1, 6),
  ); // Skip "All" collection, limit to 5

  return (
    <div className="col-span-6 mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-8 md:col-start-3 md:row-start-1 md:mt-0 lg:col-span-6 lg:col-start-2">
      <div className="grid grid-cols-1 gap-y-12 sm:col-span-2 sm:grid-cols-2 sm:gap-x-8">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Products</h3>
          <ul role="list" className="mt-6 space-y-6">
            {products.map((item) => (
              <li key={item.name} className="text-sm">
                <Link
                  href={item.href}
                  className="text-gray-500 hover:text-gray-600"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-900">Company</h3>
          <ul role="list" className="mt-6 space-y-6">
            {FOOTER_CONFIG.company.map((item) => (
              <li key={item.name} className="text-sm">
                <Link
                  href={item.href}
                  className="text-gray-500 hover:text-gray-600"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-900">Legal</h3>
        <ul role="list" className="mt-6 space-y-6">
          {FOOTER_CONFIG.legal.map((item) => (
            <li key={item.name} className="text-sm">
              <Link
                href={item.href}
                className="text-gray-500 hover:text-gray-600"
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd storefront && bunx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add storefront/components/layout/footer/footer-navigation.tsx
git commit -m "refactor(storefront): footer navigation uses static config for Company and Legal columns"
```

---

### Task 3: Update footer skeleton

**Files:**
- Modify: `storefront/components/layout/footer/index.tsx`

- [ ] **Step 1: Update NavigationSkeleton label widths**

In `storefront/components/layout/footer/index.tsx`, the `NavigationSkeleton` component has three column placeholders. Update the skeleton label widths to roughly match the new column names:
- First column label: `w-20` (Products) — keep as-is
- Second column label: `w-20` (Company) — keep as-is
- Third column label: change from `w-28` to `w-12` (Legal is shorter than "Customer Service")

Find and replace in the third skeleton column:

```tsx
// Old:
<div className="h-4 w-28 animate-pulse rounded-sm bg-gray-200" />

// New:
<div className="h-4 w-12 animate-pulse rounded-sm bg-gray-200" />
```

Also reduce the placeholder count in Company and Legal columns from 5 to 3 and 5 respectively (Company has 3 links, Legal has 5):

In the second skeleton column (Company), change `[...Array(5)]` to `[...Array(3)]`.

- [ ] **Step 2: Verify typecheck passes**

Run: `cd storefront && bunx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add storefront/components/layout/footer/index.tsx
git commit -m "style(storefront): update footer skeleton to match new column structure"
```

---

### Task 4: Create PolicyPage shared component

**Files:**
- Create: `storefront/components/legal/policy-page.tsx`

- [ ] **Step 1: Create the component**

Based on TailwindPlus "Centered" Content Section (Marketing > Page Sections > Content Sections). Adapted for legal page use: centered `max-w-3xl`, heading hierarchy, paragraph and list rendering.

```typescript
// storefront/components/legal/policy-page.tsx

export type PolicySection = {
  heading: string;
  content: (string | string[])[]; // string = paragraph, string[] = bullet list
};

export type PolicyPageProps = {
  title: string;
  effectiveDate: string;
  description: string;
  sections: PolicySection[];
};

export function PolicyPage({
  title,
  effectiveDate,
  description,
  sections,
}: PolicyPageProps) {
  return (
    <div className="bg-white px-6 py-32 lg:px-8">
      <div className="mx-auto max-w-3xl text-base/7 text-gray-700">
        <p className="text-base/7 font-semibold text-indigo-600">
          {effectiveDate}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-6 text-xl/8 text-gray-700">{description}</p>

        <div className="prose prose-gray mt-10 max-w-2xl prose-headings:tracking-tight">
          {sections.map((section) => (
            <div key={section.heading} className="mt-16 first:mt-0">
              <h2>{section.heading}</h2>
              {section.content.map((block, i) =>
                Array.isArray(block) ? (
                  <ul key={i}>
                    {block.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i}>{block}</p>
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd storefront && bunx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add storefront/components/legal/policy-page.tsx
git commit -m "feat(storefront): add shared PolicyPage component for legal pages"
```

---

### Task 5: Create legal content config

**Files:**
- Create: `storefront/lib/constants/legal-content.ts`

- [ ] **Step 1: Create the legal content file**

This file contains all five policy definitions with realistic placeholder content. Each policy follows the `PolicyPageProps` type from the PolicyPage component.

```typescript
// storefront/lib/constants/legal-content.ts
//
// PLACEHOLDER: Replace with your actual legal content.
// Use Termly (termly.io) to generate policies specific to your store.

import type { PolicyPageProps } from "components/legal/policy-page";

export const PRIVACY_POLICY: PolicyPageProps = {
  title: "Privacy Policy",
  effectiveDate: "Effective March 23, 2026",
  description:
    "This Privacy Policy describes how we collect, use, and share your personal information when you visit or make a purchase from our store.",
  sections: [
    {
      heading: "Information We Collect",
      content: [
        "When you visit our store, we automatically collect certain information about your device, including information about your web browser, IP address, time zone, and some of the cookies that are installed on your device.",
        "Additionally, as you browse the store, we collect information about the individual web pages or products that you view, what websites or search terms referred you to the store, and information about how you interact with the store.",
        "When you make a purchase or attempt to make a purchase, we collect the following information:",
        [
          "Name and billing/shipping address",
          "Email address",
          "Phone number (optional)",
          "Payment information (processed securely by our payment provider — we do not store card details)",
        ],
      ],
    },
    {
      heading: "How We Use Your Information",
      content: [
        "We use the information we collect to:",
        [
          "Fulfill orders and process transactions",
          "Communicate with you about your orders, account, or customer service inquiries",
          "Screen orders for potential risk or fraud",
          "Provide you with information or advertising relating to our products or services (only with your consent)",
          "Improve and optimize our store experience",
        ],
      ],
    },
    {
      heading: "Information Sharing",
      content: [
        "We share your personal information with third parties to help us use your information as described above. For example, we use payment processors to handle transactions securely, analytics services to understand how customers use our store, and email services for order notifications.",
        "We may also share your personal information to comply with applicable laws and regulations, to respond to a subpoena, search warrant, or other lawful request for information we receive, or to otherwise protect our rights.",
      ],
    },
    {
      heading: "Data Security",
      content: [
        "We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. All payment transactions are encrypted and processed through PCI-compliant payment processors.",
      ],
    },
    {
      heading: "Your Rights",
      content: [
        "Depending on your location, you may have certain rights regarding your personal information, including:",
        [
          "The right to access the personal information we hold about you",
          "The right to request correction of inaccurate information",
          "The right to request deletion of your personal information",
          "The right to opt out of marketing communications",
          "The right to data portability",
        ],
        "To exercise any of these rights, please contact us using the information below.",
      ],
    },
    {
      heading: "Cookies",
      content: [
        "We use cookies and similar tracking technologies to track activity on our store and hold certain information. Cookies are files with a small amount of data which may include an anonymous unique identifier. For more details, please see our Cookie Policy.",
      ],
    },
    {
      heading: "Changes to This Policy",
      content: [
        "We may update this Privacy Policy from time to time to reflect changes to our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the new policy on this page with an updated effective date.",
      ],
    },
    {
      heading: "Contact Us",
      content: [
        "For more information about our privacy practices, if you have questions, or if you would like to make a complaint, please contact us by email or by mail using the details provided on our Contact page.",
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: PolicyPageProps = {
  title: "Terms of Service",
  effectiveDate: "Effective March 23, 2026",
  description:
    "Please read these Terms of Service carefully before using our store. By accessing or using our service, you agree to be bound by these terms.",
  sections: [
    {
      heading: "Acceptance of Terms",
      content: [
        "By accessing and using this website, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use this service.",
      ],
    },
    {
      heading: "Account Registration",
      content: [
        "To access certain features, you may be required to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
        "You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.",
      ],
    },
    {
      heading: "Products and Pricing",
      content: [
        "All product descriptions, images, and pricing are subject to change without notice. We make every effort to display accurate product information, but we do not warrant that product descriptions, pricing, or other content is accurate, complete, reliable, current, or error-free.",
        "We reserve the right to refuse or cancel any order for any reason, including but not limited to product availability, errors in product or pricing information, or suspected fraudulent activity.",
      ],
    },
    {
      heading: "Orders and Payment",
      content: [
        "By placing an order, you represent that the products ordered will be used only in a lawful manner. All payments are processed securely through our third-party payment processor.",
        "We accept the following payment methods:",
        [
          "Credit and debit cards (Visa, Mastercard, American Express)",
          "Other payment methods as displayed at checkout",
        ],
      ],
    },
    {
      heading: "Shipping",
      content: [
        "Shipping times and costs vary depending on your location and the shipping method selected. Please refer to our Shipping Policy for detailed information about delivery timeframes and rates.",
      ],
    },
    {
      heading: "Returns and Refunds",
      content: [
        "Our return and refund policies are outlined in our Return Policy. Please review it before making a purchase to understand your rights and our procedures.",
      ],
    },
    {
      heading: "Intellectual Property",
      content: [
        "All content on this website, including but not limited to text, graphics, logos, images, and software, is the property of our company or its content suppliers and is protected by intellectual property laws. You may not reproduce, distribute, modify, or create derivative works from any content without our prior written consent.",
      ],
    },
    {
      heading: "Limitation of Liability",
      content: [
        "To the fullest extent permitted by applicable law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of our service.",
      ],
    },
    {
      heading: "Governing Law",
      content: [
        "These Terms shall be governed and construed in accordance with the laws of the jurisdiction in which our company is established, without regard to its conflict of law provisions.",
      ],
    },
    {
      heading: "Contact Us",
      content: [
        "If you have any questions about these Terms of Service, please contact us using the details provided on our Contact page.",
      ],
    },
  ],
};

export const RETURN_POLICY: PolicyPageProps = {
  title: "Return Policy",
  effectiveDate: "Effective March 23, 2026",
  description:
    "We want you to be completely satisfied with your purchase. If you are not happy with your order, we are here to help.",
  sections: [
    {
      heading: "Return Eligibility",
      content: [
        "You may return most new, unopened items within 30 days of delivery for a full refund. Items must be in their original packaging and in the same condition you received them.",
        "To be eligible for a return:",
        [
          "The item must be unused and in the same condition that you received it",
          "The item must be in its original packaging",
          "You must have a receipt or proof of purchase",
          "The return must be initiated within 30 days of delivery",
        ],
      ],
    },
    {
      heading: "Return Process",
      content: [
        "To initiate a return, please contact our customer service team with your order number and reason for the return. We will provide you with return shipping instructions and a return authorization number.",
        "Please do not send items back without first contacting us, as returns without authorization may not be processed.",
      ],
    },
    {
      heading: "Refunds",
      content: [
        "Once your return is received and inspected, we will send you an email to notify you that we have received your returned item. We will also notify you of the approval or rejection of your refund.",
        "If approved, your refund will be processed and a credit will automatically be applied to your original method of payment within 5-10 business days.",
      ],
    },
    {
      heading: "Exchanges",
      content: [
        "If you need to exchange an item for a different size, color, or product, please contact our customer service team. We will help you process the exchange as quickly as possible.",
      ],
    },
    {
      heading: "Non-Returnable Items",
      content: [
        "Certain items cannot be returned, including:",
        [
          "Gift cards",
          "Downloadable or digital products",
          "Items marked as final sale",
          "Personal care items that have been opened or used",
        ],
      ],
    },
    {
      heading: "Damaged or Defective Items",
      content: [
        "If you receive a damaged or defective item, please contact us immediately with photos of the damage. We will arrange for a replacement or full refund at no additional cost to you.",
      ],
    },
    {
      heading: "Contact Us",
      content: [
        "If you have any questions about our Return Policy, please contact us using the details provided on our Contact page.",
      ],
    },
  ],
};

export const SHIPPING_POLICY: PolicyPageProps = {
  title: "Shipping Policy",
  effectiveDate: "Effective March 23, 2026",
  description:
    "We are committed to delivering your order accurately, in good condition, and on time. Please review our shipping policy below.",
  sections: [
    {
      heading: "Processing Time",
      content: [
        "Orders are typically processed within 1-2 business days after payment confirmation. During peak seasons or promotional periods, processing times may be slightly longer.",
        "You will receive a confirmation email once your order has been placed, and a shipping notification with tracking information once your order has shipped.",
      ],
    },
    {
      heading: "Shipping Methods",
      content: [
        "We offer the following shipping options:",
        [
          "Standard Shipping — 5-7 business days",
          "Express Shipping — 2-3 business days",
        ],
        "Delivery times are estimates and are not guaranteed. Actual delivery times may vary based on your location and other factors outside our control.",
      ],
    },
    {
      heading: "Shipping Rates",
      content: [
        "Shipping rates are calculated at checkout based on the weight and dimensions of your order, your shipping address, and the shipping method selected. Free shipping promotions may be available from time to time.",
      ],
    },
    {
      heading: "Tracking",
      content: [
        "Once your order has shipped, you will receive a shipping confirmation email with a tracking number. You can use this number to track your package on the carrier's website. Tracking information may take up to 24 hours to become active after you receive the notification.",
      ],
    },
    {
      heading: "International Shipping",
      content: [
        "We currently ship to select international destinations. International orders may be subject to import duties, taxes, and customs fees, which are the responsibility of the recipient.",
        "Please note that international shipping times may vary and are subject to customs processing delays.",
      ],
    },
    {
      heading: "Lost or Damaged Packages",
      content: [
        "If your package is lost or arrives damaged, please contact us within 7 days of the expected delivery date. We will work with the carrier to resolve the issue and ensure you receive your order or a full refund.",
      ],
    },
    {
      heading: "Contact Us",
      content: [
        "If you have any questions about our Shipping Policy, please contact us using the details provided on our Contact page.",
      ],
    },
  ],
};

export const COOKIE_POLICY: PolicyPageProps = {
  title: "Cookie Policy",
  effectiveDate: "Effective March 23, 2026",
  description:
    "This Cookie Policy explains how we use cookies and similar technologies to recognize you when you visit our store.",
  sections: [
    {
      heading: "What Are Cookies",
      content: [
        "Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners to make their websites work, or to work more efficiently, as well as to provide reporting information.",
      ],
    },
    {
      heading: "Types of Cookies We Use",
      content: [
        "We use the following types of cookies:",
        [
          "Essential Cookies — Required for the website to function properly (e.g., shopping cart, authentication)",
          "Analytics Cookies — Help us understand how visitors interact with our website by collecting and reporting information anonymously",
          "Preference Cookies — Remember your settings and preferences to provide a more personalized experience",
        ],
      ],
    },
    {
      heading: "Managing Cookies",
      content: [
        "Most web browsers allow you to control cookies through their settings. You can set your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you disable cookies, some parts of our website may not function properly.",
        "You can also opt out of specific analytics tracking by using browser extensions or privacy tools.",
      ],
    },
    {
      heading: "Third-Party Cookies",
      content: [
        "In addition to our own cookies, we may also use various third-party cookies to report usage statistics of the website and deliver advertisements on and through the website. These include analytics providers and payment processors.",
      ],
    },
    {
      heading: "Changes to This Policy",
      content: [
        "We may update this Cookie Policy from time to time to reflect changes in technology, regulation, or our business practices. Any changes will be posted on this page with an updated effective date.",
      ],
    },
    {
      heading: "Contact Us",
      content: [
        "If you have any questions about our use of cookies, please contact us using the details provided on our Contact page.",
      ],
    },
  ],
};
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd storefront && bunx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors (imports resolve, types match `PolicyPageProps`)

- [ ] **Step 3: Commit**

```bash
git add storefront/lib/constants/legal-content.ts
git commit -m "feat(storefront): add placeholder legal content for all five policy pages"
```

---

### Task 6: Create legal page route files

**Files:**
- Create: `storefront/app/privacy-policy/page.tsx`
- Create: `storefront/app/terms-of-service/page.tsx`
- Create: `storefront/app/return-policy/page.tsx`
- Create: `storefront/app/shipping-policy/page.tsx`
- Create: `storefront/app/cookie-policy/page.tsx`

**Important:** These routes go directly under `storefront/app/`, NOT under `storefront/app/(store)/`. The `(store)` route group wraps content in a product catalog layout (search header, sort controls, collections sidebar). Legal pages need the root layout only (header + footer).

- [ ] **Step 1: Create privacy-policy/page.tsx**

```typescript
// storefront/app/privacy-policy/page.tsx
import type { Metadata } from "next";
import { PolicyPage } from "components/legal/policy-page";
import { PRIVACY_POLICY } from "lib/constants/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how we collect, use, and protect your personal information.",
  robots: { index: true },
};

export default function PrivacyPolicyPage() {
  return <PolicyPage {...PRIVACY_POLICY} />;
}
```

- [ ] **Step 2: Create terms-of-service/page.tsx**

```typescript
// storefront/app/terms-of-service/page.tsx
import type { Metadata } from "next";
import { PolicyPage } from "components/legal/policy-page";
import { TERMS_OF_SERVICE } from "lib/constants/legal-content";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read the terms and conditions for using our store.",
  robots: { index: true },
};

export default function TermsOfServicePage() {
  return <PolicyPage {...TERMS_OF_SERVICE} />;
}
```

- [ ] **Step 3: Create return-policy/page.tsx**

```typescript
// storefront/app/return-policy/page.tsx
import type { Metadata } from "next";
import { PolicyPage } from "components/legal/policy-page";
import { RETURN_POLICY } from "lib/constants/legal-content";

export const metadata: Metadata = {
  title: "Return Policy",
  description: "Understand our return and refund process.",
  robots: { index: true },
};

export default function ReturnPolicyPage() {
  return <PolicyPage {...RETURN_POLICY} />;
}
```

- [ ] **Step 4: Create shipping-policy/page.tsx**

```typescript
// storefront/app/shipping-policy/page.tsx
import type { Metadata } from "next";
import { PolicyPage } from "components/legal/policy-page";
import { SHIPPING_POLICY } from "lib/constants/legal-content";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description:
    "Learn about our shipping methods, rates, and delivery timeframes.",
  robots: { index: true },
};

export default function ShippingPolicyPage() {
  return <PolicyPage {...SHIPPING_POLICY} />;
}
```

- [ ] **Step 5: Create cookie-policy/page.tsx**

```typescript
// storefront/app/cookie-policy/page.tsx
import type { Metadata } from "next";
import { PolicyPage } from "components/legal/policy-page";
import { COOKIE_POLICY } from "lib/constants/legal-content";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Learn how we use cookies and similar tracking technologies.",
  robots: { index: true },
};

export default function CookiePolicyPage() {
  return <PolicyPage {...COOKIE_POLICY} />;
}
```

- [ ] **Step 6: Verify typecheck passes**

Run: `cd storefront && bunx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add storefront/app/privacy-policy/page.tsx storefront/app/terms-of-service/page.tsx storefront/app/return-policy/page.tsx storefront/app/shipping-policy/page.tsx storefront/app/cookie-policy/page.tsx
git commit -m "feat(storefront): add five legal page routes with SEO metadata"
```

---

### Task 7: Dead code cleanup

**Files:**
- Modify: `storefront/lib/utils.ts` (remove `transformMenuToFooterNav` at lines 143-151)
- Modify: `storefront/lib/medusa/index.ts` (remove `getMenu` at lines 523-537)

- [ ] **Step 1: Remove `transformMenuToFooterNav` from utils.ts**

Delete the function and its comment (lines 143-151 of `storefront/lib/utils.ts`):

```typescript
// Remove this entire block:
// Transform Menu items to footer navigation format
export const transformMenuToFooterNav = (
  menu: Menu[],
): { name: string; href: string }[] => {
  return menu.map((item) => ({
    name: item.title,
    href: item.path,
  }));
};
```

Also update the import on line 6 of `storefront/lib/utils.ts` — remove `Menu` since it's only used by the deleted function:

```typescript
// Old:
import type { Collection, Menu, Product } from "./types";

// New:
import type { Collection, Product } from "./types";
```

- [ ] **Step 2: Remove `getMenu` from lib/medusa/index.ts**

Delete the function (lines 523-537 of `storefront/lib/medusa/index.ts`):

```typescript
// Remove this entire block:
export async function getMenu(handle: string): Promise<Menu[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  if (handle.includes("footer")) {
    const collections = await getCollections();
    return collections
      .filter((c) => c.handle !== "")
      .slice(0, 6)
      .map((c) => ({ title: c.title, path: c.path }));
  }

  return [];
}
```

Also update the import on lines 5-12 of `storefront/lib/medusa/index.ts` — remove `Menu` since it's only used by the deleted function:

```typescript
// Old:
import type {
  Cart,
  Collection,
  Menu,
  Navigation,
  Page,
  Product,
} from "lib/types";

// New:
import type {
  Cart,
  Collection,
  Navigation,
  Page,
  Product,
} from "lib/types";
```

- [ ] **Step 3: Verify no remaining references to removed functions**

Run: `cd storefront && grep -r "getMenu\|transformMenuToFooterNav" --include="*.ts" --include="*.tsx" .`
Expected: No matches (confirming all references are removed)

- [ ] **Step 4: Verify typecheck passes**

Run: `cd storefront && bunx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add storefront/lib/utils.ts storefront/lib/medusa/index.ts
git commit -m "refactor(storefront): remove unused getMenu and transformMenuToFooterNav"
```

---

### Task 8: Update SETUP.md

**Files:**
- Modify: `SETUP.md`

- [ ] **Step 1: Add Legal Pages section**

Add a new section after the "Meilisearch (optional)" section (after line 224) and before "Production Deployment":

```markdown
### 8. Legal Pages

The storefront ships with five placeholder legal pages:

- `/privacy-policy`
- `/terms-of-service`
- `/return-policy`
- `/shipping-policy`
- `/cookie-policy`

**To replace with your actual legal content:**

1. Use [Termly](https://termly.io) (or a similar service) to generate policies specific to your store
2. Replace the placeholder text in `storefront/lib/constants/legal-content.ts`
3. Update the effective dates

When migrating to a CMS (e.g., Payload), swap the import source in each route file — the `PolicyPage` component and routes stay the same.
```

- [ ] **Step 2: Commit**

```bash
git add SETUP.md
git commit -m "docs: add Legal Pages section to SETUP.md with Termly recommendation"
```

---

### Task 9: Build verification

- [ ] **Step 1: Run typecheck**

Run: `cd storefront && bunx tsc --noEmit --pretty`
Expected: Clean pass, no errors

- [ ] **Step 2: Run production build**

Run: `cd storefront && bun run build 2>&1 | tail -20`
Expected: Build succeeds. Verify the five legal page routes appear in the build output:
- `/privacy-policy`
- `/terms-of-service`
- `/return-policy`
- `/shipping-policy`
- `/cookie-policy`

- [ ] **Step 3: Start dev server and spot-check**

Run: `cd storefront && bun dev`

Verify manually:
1. Footer shows three distinct columns: Products (dynamic from Medusa), Company (About, Contact, FAQ), Legal (5 policy links)
2. Click each Legal link — page loads with correct title, effective date, and placeholder content
3. Legal pages have header and footer but NO product catalog chrome (no search header, no sort controls, no collections sidebar)

- [ ] **Step 4: Final commit if any fixes needed**

If the build or spot-check reveals issues, fix them and commit the fixes.
