# Footer Restructure & Legal Pages

**Date:** 2026-03-23
**Status:** Approved

## Problem

The storefront footer has three columns (Products, Company, Customer Service) all rendering the same Medusa collection data — the Company and Customer Service columns fall back to collections because no real menus are configured. The footer needs to show distinct, meaningful content: product categories, company links, and legal/policy links. Additionally, no legal/policy pages exist, and they are required for a production ecommerce store.

## Decisions

- **Footer link management:** Hardcode Company and Legal columns in a config file. Products column stays dynamic from Medusa collections. This avoids unnecessary backend work and provides a clean migration path to Payload CMS later (swap the config import source).
- **Legal page template:** Use TailwindPlus "Centered" Content Section (Marketing > Page Sections > Content Sections) as the base for a shared `PolicyPage` component. `@tailwindcss/typography` is already installed and will be used for prose styling.
- **Legal page content:** Placeholder/template content now. SETUP.md will document using Termly to generate real policies.
- **Company pages:** Not built in this work. Footer links will point to routes that don't exist yet — this is intentional and will be addressed in a future CMS integration.

## Scope

### In scope

1. Footer config refactor (3 columns: Products, Company, Legal)
2. Five legal pages with shared template component
3. SETUP.md documentation for legal content generation
4. Dead code cleanup

### Out of scope

- Company pages (About, Contact, FAQ)
- CMS integration (Payload or otherwise)
- Admin-configurable footer links
- Footer visual redesign (layout stays the same — only content changes)

## Architecture

### 1. Footer Config

**New file: `storefront/lib/constants/footer.ts`**

```typescript
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

The Products column continues to use `getCollections()` from Medusa — no change to that data source.

### 2. Footer Navigation Component

**Modified file: `storefront/components/layout/footer/footer-navigation.tsx`**

Changes:
- Remove `getMenu("footer-company")` and `getMenu("footer-customer-service")` calls
- Import `FOOTER_CONFIG` from `lib/constants/footer`
- Products column: unchanged (Medusa collections)
- Company column: renders `FOOTER_CONFIG.company`
- Third column renamed from "Customer Service" to "Legal", renders `FOOTER_CONFIG.legal`
- Remove `transformMenuToFooterNav` import

The component remains an async server component because Products still fetches from Medusa.

### 3. Footer Skeleton

**Modified file: `storefront/components/layout/footer/index.tsx`**

Update `NavigationSkeleton` to reflect the 3-column structure. Cosmetic only — no logic change.

### 4. Legal Page Shared Component

**New file: `storefront/components/legal/policy-page.tsx`**

Server component based on TailwindPlus "Centered" Content Section. Props:

```typescript
type PolicySection = {
  heading: string;
  content: (string | string[])[]; // string = paragraph, string[] = bullet list
};

type PolicyPageProps = {
  title: string;
  effectiveDate: string;
  description: string; // intro paragraph
  sections: PolicySection[];
};
```

Layout:
- Centered `max-w-3xl` container
- `h1` for page title, subtitle for effective date
- Intro paragraph
- `h2` for each section heading with `mt-16` spacing
- Paragraphs with `text-base/7 text-gray-700`
- Unordered lists for bullet-point content
- Uses `@tailwindcss/typography` `prose` classes where beneficial

### 5. Legal Content Config

**New file: `storefront/lib/constants/legal-content.ts`**

Contains all five policy definitions with typed structure matching `PolicyPageProps`. Each policy has realistic section headings with placeholder content:

| Policy | Sections |
|--------|----------|
| Privacy Policy | Information We Collect, How We Use Your Information, Information Sharing, Data Security, Your Rights, Cookies, Changes to This Policy, Contact Us |
| Terms of Service | Acceptance of Terms, Account Registration, Products and Pricing, Orders and Payment, Shipping, Returns and Refunds, Intellectual Property, Limitation of Liability, Governing Law, Contact Us |
| Return Policy | Return Eligibility, Return Process, Refunds, Exchanges, Non-Returnable Items, Damaged or Defective Items, Contact Us |
| Shipping Policy | Processing Time, Shipping Methods, Shipping Rates, Tracking, International Shipping, Lost or Damaged Packages, Contact Us |
| Cookie Policy | What Are Cookies, Types of Cookies We Use, Managing Cookies, Third-Party Cookies, Changes to This Policy, Contact Us |

A comment at the top of the file: `// PLACEHOLDER: Replace with your actual legal content. Use Termly (termly.io) to generate policies specific to your store.`

Effective date for all placeholders: "March 23, 2026".

### 6. Route Files

Five thin route files under `storefront/app/(store)/`:

- `privacy-policy/page.tsx`
- `terms-of-service/page.tsx`
- `return-policy/page.tsx`
- `shipping-policy/page.tsx`
- `cookie-policy/page.tsx`

Each file (~15-20 lines):
1. Imports the relevant content from `legal-content.ts`
2. Exports `generateMetadata()` with title, description, and `robots: { index: true }`
3. Renders `<PolicyPage {...content} />`

All routes are under the `(store)` route group and inherit the standard header/footer layout.

### 7. Dead Code Cleanup

- Remove `transformMenuToFooterNav` from `storefront/lib/utils.ts`
- Evaluate whether `getMenu` in `lib/medusa/index.ts` is used anywhere else — if only by the footer, add a comment noting it's available for future CMS use but currently unused

### 8. SETUP.md Update

Add a "Legal Pages" subsection documenting:
- Legal pages ship with placeholder content
- Recommend [Termly](https://termly.io) to generate store-specific policies
- Content lives in `storefront/lib/constants/legal-content.ts` — replace placeholder text there
- When migrating to a CMS, swap the import source; the `PolicyPage` component and routes stay the same

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `storefront/lib/constants/footer.ts` | Create | Footer column config (Company + Legal links) |
| `storefront/components/layout/footer/footer-navigation.tsx` | Modify | Use config for Company/Legal, keep Medusa for Products |
| `storefront/components/layout/footer/index.tsx` | Modify | Update skeleton to match new 3-column structure |
| `storefront/components/legal/policy-page.tsx` | Create | Shared legal page template component |
| `storefront/lib/constants/legal-content.ts` | Create | Placeholder content for all 5 policies |
| `storefront/app/(store)/privacy-policy/page.tsx` | Create | Privacy Policy route |
| `storefront/app/(store)/terms-of-service/page.tsx` | Create | Terms of Service route |
| `storefront/app/(store)/return-policy/page.tsx` | Create | Return Policy route |
| `storefront/app/(store)/shipping-policy/page.tsx` | Create | Shipping Policy route |
| `storefront/app/(store)/cookie-policy/page.tsx` | Create | Cookie Policy route |
| `storefront/lib/utils.ts` | Modify | Remove `transformMenuToFooterNav` |
| `SETUP.md` | Modify | Add Legal Pages documentation |

## CMS Migration Path

When Payload CMS is adopted:
1. Create a "Legal Page" content type in Payload with title, effective date, and rich text sections
2. Replace the static imports in each route file with Payload API calls
3. The `PolicyPage` component and route files remain unchanged — only the data source changes
4. Footer Company links can similarly move to a Payload "Navigation" content type

## Testing

- Verify footer renders 3 distinct columns: Products (from Medusa), Company (static), Legal (static)
- Verify all 5 legal page routes load with correct content and metadata
- Verify legal pages use the `(store)` layout (header + footer present)
- Verify footer Legal links navigate to the correct pages
- Build succeeds (`bun run build`)
- Typecheck passes (`bun run typecheck`)
