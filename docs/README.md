# CrowCommerce — Project Status

Last updated: 2026-03-18

## Feature Status

| Feature | Status | What's shipped | What's remaining |
|---------|--------|----------------|-----------------|
| Medusa v2 integration | ✅ Shipped | Full catalog + cart | — |
| Customer accounts | ✅ Shipped | Auth, profile, orders, addresses | — |
| Stripe checkout | ✅ Shipped | 5-step flow, saved cards, guest checkout | — |
| Product quick view | ✅ Shipped | Hover overlay modal on grid | — |
| Production deployment | ✅ Shipped | Vercel + Railway | — |
| [Email infrastructure](features/email-infrastructure.md) | 🟡 Partial | Stacks 1-5 (8 templates + invoices) | Stacks 6-7 (premium, quotes) |
| [Product reviews](features/product-reviews.md) | 🟡 Partial | Phases 1-2 (core + images) | Phase 3 (verified purchase, search) |
| [Wishlist](features/wishlist.md) | ✅ Shipped | Full feature + E2E tests | Code review follow-ups only |
| Invoice generation | ✅ Shipped | On-demand PDF, admin config, email toggle, customer + admin download | Code review follow-ups only |

## Infrastructure & Tooling

| Item | Status | Notes |
|------|--------|-------|
| S3 file provider | ⏳ Not started | Replace local file storage |
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

- [Email infrastructure](architecture/email-infrastructure.md)
- [Medusa integration design](architecture/medusa-integration.md)

## Archive

Completed plans and specs: [docs/archive/](archive/)
