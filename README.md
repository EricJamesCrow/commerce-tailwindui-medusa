# CrowCommerce

![Version](https://img.shields.io/badge/version-0.0.0-2563eb)
![License](https://img.shields.io/badge/license-TBD-6b7280)
![Stack](https://img.shields.io/badge/stack-Next.js%2016%20%7C%20Medusa%202.13%20%7C%20Tailwind%204-111827)
![Monorepo](https://img.shields.io/badge/monorepo-Bun%20workspaces%20%2B%20Turbo-f59e0b)

CrowCommerce is a commerce template monorepo that pairs a Vercel Commerce-derived Next.js 16 storefront with a Medusa v2 backend, Tailwind Plus UI patterns, and production integrations for Stripe, PostHog, Sentry, Resend, Meilisearch, and Cloudflare R2.

Last updated: 2026-03-30

- **[Setup Guide](SETUP.md)** — local development through production deployment
- **[Fork-Per-Client Ownership Model](docs/forking.md)** — template boundaries, site-owned paths, and backport rules

**Vercel ownership:** This storefront is deployed from the **CrowCommerce** Vercel team with slug `crow-commerce`. The correct Vercel project path is `crow-commerce/commerce-tailwindui-medusa`.

## Built On

This project builds directly on:

- **[Vercel Commerce](https://github.com/vercel/commerce)** — the storefront is a Vercel Commerce fork, with the Shopify adapter replaced by Medusa. The routing conventions, caching patterns, and type shapes follow Vercel Commerce closely.
- **[Medusa Starter / Medusa v2](https://github.com/medusajs/medusa)** — the backend is a Medusa v2 starter extended with custom modules, workflows, admin extensions, and integrations.
- **[Tailwind Plus / Tailwind UI](https://tailwindcss.com/plus)** — the UI design system is built on Tailwind Plus ecommerce blocks. Component layouts, the seed catalog, and interaction patterns all draw from Tailwind UI.
- **[Medusa Next.js Starter](https://github.com/medusajs/nextjs-starter-medusa)** — the customer account flows and Stripe checkout customization follow patterns from the Medusa Next.js starter.
- **[Untitled UI React Email](https://www.untitledui.com/)** — the email system was rebuilt from Untitled UI email primitives, remapped to CrowCommerce/Tailwind tokens.
- **[Medusa Product Reviews Tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/product-reviews)** — primary reference for the review module and storefront/admin review flows.
- **[Medusa Wishlist Tutorial](https://docs.medusajs.com/resources/plugins/guides/wishlist)** plus **[@alphabite/medusa-wishlist](https://github.com/alphabite-dev/medusa-wishlist)** and **[@godscodes/medusajs-wishlist-plugin](https://github.com/godscodes/medusajs-wishlist-plugin)** — the wishlist architecture, guest flows, share tokens, and storefront action patterns draw from all three.
- **[Medusa Checkout Docs](https://docs.medusajs.com/resources/storefront-development/checkout)**, **[Saved Payment Methods Tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/saved-payment-methods)**, and **[lambda-curry/medusa2-starter](https://github.com/lambda-curry/medusa2-starter)** — the Stripe checkout flow, saved cards, and guest checkout are built against these references.
- **[Medusa Invoice Generator Tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/invoice-generator)** — reference for the invoice module and PDF generation workflow.
- **[Medusa Abandoned Cart Tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/abandoned-cart)** — reference for the cart recovery email flow.
- **[lambda-curry/medusa-plugins](https://github.com/lambda-curry/medusa-plugins)** and **[@devx-commerce/plugin-product-reviews](https://www.npmjs.com/package/@devx-commerce/plugin-product-reviews)** — pattern references for the review image uploads and admin response features.

## Screenshots

![Storefront homepage](docs/screenshots/storefront-home.png)
![Product detail page](docs/screenshots/product-page.png)
![Checkout flow](docs/screenshots/cart-checkout.png)
![Customer account sign-in](docs/screenshots/account-login.png)
![Medusa admin sign-in](docs/screenshots/admin-login.png)

## Tech Stack

| Layer                          | Actual packages / services                                                                               | Version(s) from repo                                                                                                                                          | Purpose                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Monorepo                       | Bun workspaces, Turborepo                                                                                | `bun@1.1.18`, `turbo@2.8.20`                                                                                                                                  | Workspace management, parallel dev/build/test orchestration                  |
| Storefront framework           | Next.js, React, React DOM                                                                                | `next@16.0.7`, `react@19.0.0`, `react-dom@19.0.0`                                                                                                             | App Router storefront with RSC, Server Actions, metadata, OG image routes    |
| Frontend language/tooling      | TypeScript, PostCSS                                                                                      | `typescript@5.8.2`, `postcss@8.5.3`                                                                                                                           | Strict typing and build tooling                                              |
| Styling and UI                 | Tailwind CSS, Headless UI, Heroicons, `clsx`, Geist                                                      | `tailwindcss@4.0.14`, `@headlessui/react@2.2.0`, `@heroicons/react@2.2.0`, `clsx@2.1.1`, `geist@1.3.1`                                                        | Design system implementation and accessible interactive UI                   |
| Commerce storefront client     | `@medusajs/js-sdk`, `@medusajs/types`                                                                    | `2.13.1`                                                                                                                                                      | Store API access and Medusa response typing                                  |
| Payments                       | Stripe JS + React Stripe JS                                                                              | `@stripe/stripe-js@8.8.0`, `@stripe/react-stripe-js@5.6.0`                                                                                                    | Checkout, Payment Element, saved cards, redirect flows                       |
| Search                         | Meilisearch, React InstantSearch                                                                         | `meilisearch@0.56.0`, `@meilisearch/instant-meilisearch@0.30.0`, `react-instantsearch@7.28.0`                                                                 | Search command palette, `/search` query-param filtering, backend indexing    |
| Analytics and error monitoring | PostHog, Sentry                                                                                          | `posthog-js@1.363.1`, `posthog-node@5.28.5`, `@sentry/nextjs@^10`, `@sentry/node@^10`, `@sentry/profiling-node@^10`                                           | Typed analytics, feature flags, replay, tracing, exception capture           |
| Validation                     | Zod                                                                                                      | `zod@3.25.76`                                                                                                                                                 | Server action and route validation                                           |
| Backend framework              | Medusa core packages                                                                                     | `@medusajs/framework@2.13.1`, `@medusajs/medusa@2.13.1`, `@medusajs/admin-sdk@2.13.1`, `@medusajs/cli@2.13.1`                                                 | Headless commerce backend, admin, workflows, modules, CLI                    |
| Backend integrations           | Redis caching, PostHog analytics module, ioredis, jsonwebtoken, multer, Meilisearch                      | `@medusajs/caching-redis@2.13.1`, `@medusajs/analytics-posthog@2.13.1`, `ioredis@5.10.0`, `jsonwebtoken@9.0.3`, `multer@2.1.1`, `meilisearch@0.56.0`          | Caching/event infra, backend analytics, auth/share tokens, uploads, indexing |
| Email and documents            | Resend, React Email, React PDF                                                                           | `resend@6.9.3`, `@react-email/components@1.0.9`, `@react-email/render@2.0.4`, `@react-email/tailwind@2.0.5`, `react-email@5.2.9`, `@react-pdf/renderer@4.3.2` | Transactional emails, previews, invoice PDF generation                       |
| Testing                        | Playwright, Vitest, Jest, Testing Library                                                                | `@playwright/test@1.56.1`, `vitest@4.0.1`, `jest@29.7.0`, `@testing-library/react@16.3.0`, `@testing-library/jest-dom@6.9.1`                                  | E2E smoke/deep coverage plus deterministic unit tests                        |
| Formatting/build support       | Prettier, Prettier Tailwind plugin, SWC, Vite                                                            | `prettier@3.5.3`, `prettier-plugin-tailwindcss@0.6.11`, `@swc/core@1.7.28`, `@swc/jest@0.2.36`, `vite@5.4.14`                                                 | Formatting, test transforms, Medusa admin tooling                            |
| Deployment and hosted infra    | Vercel, Railway, PostgreSQL 17, Redis, Stripe, Resend, Cloudflare R2, PostHog, Sentry, Meilisearch Cloud | Configured in repo docs and env examples                                                                                                                      | Production storefront/backend hosting and operational services               |

## Workspace Layout

```text
storefront/           Next.js 16 storefront
backend/              Medusa v2 backend + admin
packages/site-config/ Site-owned brand, navigation, and integration config
tooling/typescript/   Shared TypeScript configuration
```

## Feature Overview

Features shipped in roughly this order: Medusa integration, customer accounts, reviews, wishlist, Stripe checkout, production deployment, product quick view, email infrastructure, invoice generation, S3/R2 storage, Sentry, PostHog, newsletter signup, Meilisearch search, legal/company pages, and site-boundary scaffolding.

| Feature                                                       | Status     | What's shipped                                                                                                                                                                        | What's remaining                                                  |
| ------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Medusa v2 integration                                         | ✅ Shipped | Full catalog + cart                                                                                                                                                                   | —                                                                 |
| Customer accounts                                             | ✅ Shipped | Auth, profile, addresses, order history, and order detail pages                                                                                                                       | —                                                                 |
| Stripe checkout                                               | ✅ Shipped | 5-step flow, saved cards, guest checkout                                                                                                                                              | —                                                                 |
| Product quick view                                            | ✅ Shipped | Hover overlay modal on grid                                                                                                                                                           | —                                                                 |
| Production deployment                                         | ✅ Shipped | Vercel + Railway                                                                                                                                                                      | —                                                                 |
| [Email infrastructure](docs/features/email-infrastructure.md) | 🟡 Partial | Stacks 1-5 (8 templates + invoices)                                                                                                                                                   | Stacks 6-7 (premium, quotes)                                      |
| [Product reviews](docs/features/product-reviews.md)           | 🟡 Partial | Core reviews, admin responses, review images, and verified purchase badges                                                                                                            | Admin review search and review editing                            |
| [Wishlist](docs/features/wishlist.md)                         | ✅ Shipped | Full feature + E2E tests                                                                                                                                                              | Code review follow-ups only                                       |
| Invoice generation                                            | ✅ Shipped | On-demand PDF with product thumbnails, admin config, email toggle, customer + admin download, code review fixes applied                                                               | —                                                                 |
| Newsletter signup                                             | 🟡 Partial | Footer form, welcome + welcome-back emails, Resend Audience sync, opaque server-stored unsubscribe tokens, tokenless unsubscribe confirmation redirect, rate limiting, PostHog events | Email preferences flow and final unsubscribe privacy verification |
| [Search](docs/features/search.md)                             | 🟡 Partial | Meilisearch indexing, Cmd+K Meilisearch path, `/search` Meilisearch query-param filtering/sorting, Medusa fallback                                                                    | Shared faceted filter UI on the search results page               |
| [Company pages](docs/features/contact-form.md)                | ✅ Shipped | Static `/about`, `/faq`, and backend-backed `/contact` with Resend delivery, validation, analytics, and spam protection                                                               | —                                                                 |
| Fork-per-client scaffolding                                   | 🟡 Partial | `packages/site-config`, `storefront/site`, and `backend/src/site` are scaffolded and partly wired into shared code                                                                    | More client-owned delegation and concrete extension examples      |

## Infrastructure & Tooling

| Item                                   | Status         | Notes                                                                                                                                                                                                                          |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S3 file provider (Cloudflare R2)       | ✅ Shipped     | Persistent file storage via R2, E2E tests                                                                                                                                                                                      |
| Sentry error monitoring                | ✅ Shipped     | Full error capture (checkout, cart, auth, 13 subscribers, jobs), user context enrichment, environment separation, 5xx-only proxy policy                                                                                        |
| PostHog analytics                      | ✅ Shipped     | 45 storefront events + 8 backend events, session replay, web vitals, feature flags, experiments, surveys (NPS + exit), trackGoal()                                                                                             |
| CI/CD (GitHub Actions)                 | 🟡 Partial     | GitHub Actions now runs storefront/backend typecheck, Prettier, storefront/backend unit tests, a storefront production compile check, and Playwright smoke coverage for eligible PRs. Preview/health checks are still missing. |
| Medusa webhooks for cache revalidation | 🟡 Partial     | Backend product and collection events already trigger storefront catalog revalidation. Production end-to-end verification is still pending.                                                                                    |
| Vitest unit tests                      | 🟡 Partial     | Deterministic unit coverage exists for transforms, analytics PII redaction, checkout schemas, Sentry config, structured data, order status, and shared validation.                                                             |
| Playwright E2E coverage                | 🟡 Partial     | Smoke flows cover storefront load, browse-to-cart, guest checkout, and wishlist login; deeper suites cover wishlist, reviews, search, orders, newsletter, and checkout variants.                                               |
| React Compiler optimization            | ⏳ Not started | Compiler enabled, no audit yet                                                                                                                                                                                                 |

## Deferred Features

These are features identified but not yet planned in detail:

- Multi-region / multi-currency support
- Collections/categories with images
- CMS pages (Payload CMS integration)
- Re-order previous purchases (temporarily disabled pending checkout hardening)
- Agentic commerce (AI shopping assistant, natural language search)
- Newsletter campaigns (sending/scheduling — signup is shipped)

## Quick Start

Start with **[SETUP.md](SETUP.md)**. It covers local prerequisites, self-documenting `.env.example` files, seeding the Medusa backend, optional services like Redis/Meilisearch/Stripe/Resend, and production deployment on Railway + Vercel.

For day-to-day development from the repo root:

```bash
bun install
bun run dev
```

## Architecture

CrowCommerce is organized as a Bun/Turbo monorepo with a shared template core and explicit override zones for downstream forks. The shared paths live in `storefront/`, `backend/`, `tooling/`, and `docs/`; site-specific customization already has reserved scaffolded zones in `packages/site-config/`, `storefront/site/`, and `backend/src/site/`.

- [Fork-per-client ownership model](docs/forking.md)
- [Email infrastructure](docs/architecture/email-infrastructure.md)
- [Medusa integration design](docs/architecture/medusa-integration.md)
- [PostHog analytics ADR](docs/decisions/2026-03-20-posthog-unified-analytics.md)

## Archive

Completed plans and specs: [docs/archive/](docs/archive/)

## License

Project-level license: TBD. The storefront inherits Vercel Commerce's MIT license (`storefront/license.md`); a root LICENSE file covering the full monorepo is pending.
