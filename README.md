# CrowCommerce — Project Status

Last updated: 2026-03-30

CrowCommerce is a Turborepo monorepo for the storefront, Medusa backend, and site-owned configuration that powers downstream client forks.

- **[Setup Guide](SETUP.md)** — local dev through production deployment
- **[Fork-Per-Client Ownership Model](docs/forking.md)** — template boundaries, site-owned paths, and backport rules

**Vercel ownership:** This storefront is deployed from the **CrowCommerce** Vercel team with slug `crow-commerce`. The correct Vercel project path is `crow-commerce/commerce-tailwindui-medusa`.

## Workspace Layout

```text
storefront/           Next.js 16 storefront
backend/              Medusa v2 backend + admin
packages/site-config/ Site-owned brand, navigation, and integration config
tooling/typescript/   Shared TypeScript configuration
```

## Feature Status

| Feature                                                       | Status     | What's shipped                                                                                                          | What's remaining                                 |
| ------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Medusa v2 integration                                         | ✅ Shipped | Full catalog + cart                                                                                                     | —                                                |
| Customer accounts                                             | ✅ Shipped | Auth, profile, addresses, order history, and order detail pages                                                         | —                                                |
| Stripe checkout                                               | ✅ Shipped | 5-step flow, saved cards, guest checkout                                                                                | —                                                |
| Product quick view                                            | ✅ Shipped | Hover overlay modal on grid                                                                                             | —                                                |
| Production deployment                                         | ✅ Shipped | Vercel + Railway                                                                                                        | —                                                |
| [Email infrastructure](docs/features/email-infrastructure.md) | 🟡 Partial | Stacks 1-5 (8 templates + invoices)                                                                                     | Stacks 6-7 (premium, quotes)                     |
| [Product reviews](docs/features/product-reviews.md)           | 🟡 Partial | Phases 1-2 (core + images)                                                                                              | Phase 3 (verified purchase, search)              |
| [Wishlist](docs/features/wishlist.md)                         | ✅ Shipped | Full feature + E2E tests                                                                                                | Code review follow-ups only                      |
| Invoice generation                                            | ✅ Shipped | On-demand PDF with product thumbnails, admin config, email toggle, customer + admin download, code review fixes applied | —                                                |
| Newsletter signup                                             | ✅ Shipped | Footer form, welcome + welcome-back emails, Resend Audience sync, HMAC unsubscribe, rate limiting, PostHog events       | Email preferences page, opaque unsubscribe token |
| Company pages (About, Contact, FAQ)                           | 🟡 Partial | Static `/about`, `/contact`, `/faq` pages with TailwindPlus components                                                  | Contact form backend (Resend wiring)             |

## Infrastructure & Tooling

| Item                                   | Status         | Notes                                                                                                                                                                                 |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3 file provider (Cloudflare R2)       | ✅ Shipped     | Persistent file storage via R2, E2E tests                                                                                                                                             |
| Sentry error monitoring                | ✅ Shipped     | Full error capture (checkout, cart, auth, 13 subscribers, jobs), user context enrichment, environment separation, 5xx-only proxy policy                                               |
| PostHog analytics                      | ✅ Shipped     | 45 storefront events + 8 backend events, session replay, web vitals, feature flags, experiments, surveys (NPS + exit), trackGoal()                                                    |
| CI/CD (GitHub Actions)                 | 🟡 Partial     | GitHub Actions now runs storefront/backend typecheck, Prettier, storefront/backend unit tests, and a storefront production compile check. Playwright smoke coverage is still missing. |
| Medusa webhooks for cache revalidation | 🟡 Partial     | Backend product and collection events already trigger storefront catalog revalidation. Production end-to-end verification is still pending.                                           |
| Vitest unit tests                      | 🟡 Partial     | Deterministic unit coverage exists for transforms, analytics PII redaction, checkout schemas, Sentry config, structured data, order status, and shared validation.                    |
| Playwright E2E coverage                | 🟡 Partial     | Smoke flows cover storefront load, browse-to-cart, guest checkout, and wishlist login; deeper suites cover wishlist, reviews, search, orders, newsletter, and checkout variants.      |
| React Compiler optimization            | ⏳ Not started | Compiler enabled, no audit yet                                                                                                                                                        |

## Deferred Features

These are features identified but not yet planned in detail:

- Multi-region / multi-currency support
- Collections/categories with images
- CMS pages (Payload CMS integration)
- Re-order previous purchases (temporarily disabled pending checkout hardening)
- Agentic commerce (AI shopping assistant, natural language search)
- Newsletter campaigns (sending/scheduling — signup is shipped)

## Architecture References

- [Fork-per-client ownership model](docs/forking.md)
- [Email infrastructure](docs/architecture/email-infrastructure.md)
- [Medusa integration design](docs/architecture/medusa-integration.md)
- [PostHog analytics ADR](docs/decisions/2026-03-20-posthog-unified-analytics.md)

## Archive

Completed plans and specs: [docs/archive/](docs/archive/)
