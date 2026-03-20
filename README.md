# CrowCommerce — Project Status

Last updated: 2026-03-19

**[Setup Guide](SETUP.md)** — local dev through production deployment

## Feature Status

| Feature | Status | What's shipped | What's remaining |
|---------|--------|----------------|-----------------|
| Medusa v2 integration | ✅ Shipped | Full catalog + cart | — |
| Customer accounts | ✅ Shipped | Auth, profile, orders, addresses | — |
| Stripe checkout | ✅ Shipped | 5-step flow, saved cards, guest checkout | — |
| Product quick view | ✅ Shipped | Hover overlay modal on grid | — |
| Production deployment | ✅ Shipped | Vercel + Railway | — |
| [Email infrastructure](docs/features/email-infrastructure.md) | 🟡 Partial | Stacks 1-5 (8 templates + invoices) | Stacks 6-7 (premium, quotes) |
| [Product reviews](docs/features/product-reviews.md) | 🟡 Partial | Phases 1-2 (core + images) | Phase 3 (verified purchase, search) |
| [Wishlist](docs/features/wishlist.md) | ✅ Shipped | Full feature + E2E tests | Code review follow-ups only |
| Invoice generation | ✅ Shipped | On-demand PDF with product thumbnails, admin config, email toggle, customer + admin download, code review fixes applied | — |

## Infrastructure & Tooling

| Item | Status | Notes |
|------|--------|-------|
| S3 file provider (Cloudflare R2) | ✅ Shipped | Persistent file storage via R2, E2E tests |
| Sentry error monitoring | ✅ Shipped | Backend + storefront, performance tracing, session replay |
| CI/CD (GitHub Actions) | ⏳ Not started | |
| Medusa webhooks for cache revalidation | ⏳ Not started | |
| Vitest unit tests | ⏳ Not started | Config exists, no tests written |
| React Compiler optimization | ⏳ Not started | Compiler enabled, no audit yet |

## Deferred Features

These are features identified but not yet planned in detail:

- Multi-region / multi-currency support
- Collections/categories with images
- CMS pages (Payload CMS integration)
- Re-order previous purchases
- Agentic commerce (AI shopping assistant, natural language search)
- Newsletter signup and campaigns

## Architecture References

- [Email infrastructure](docs/architecture/email-infrastructure.md)
- [Medusa integration design](docs/architecture/medusa-integration.md)

## Archive

Completed plans and specs: [docs/archive/](docs/archive/)
