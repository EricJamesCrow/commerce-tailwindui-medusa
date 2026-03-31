---
status: shipped
created: 2026-02-22
updated: 2026-03-30
---

# Wishlist

> **Core feature + Phase 2 polish shipped. E2E test suite complete (40 tests). Some code review follow-ups remain.**

## What it does

Full wishlist system with guest support (cookie-based), multiple named wishlists per customer, JWT-based sharing/import, variant-level tracking, and TailwindUI storefront UI.

## Phases

### Phase 1: Core ✅

- [x] Backend module (models, service, migration, module links)
- [x] 10 workflow steps with compensation for saga rollback
- [x] 6 workflows (create, add/delete item, delete, update, transfer)
- [x] Customer API routes (8 endpoints) with Zod validation
- [x] Guest API routes (4 endpoints) with cookie-based tracking
- [x] Shared wishlist routes (JWT sharing, 7-day expiry, import/clone)
- [x] Admin wishlist count widget
- [x] Storefront server actions (12 functions)
- [x] Auth integration (transfer on login/signup, cleanup on signout)
- [x] Heart toggle button, account wishlist page, shared wishlist page

### Phase 2: Polish ✅

- [x] Nav badge (heart icon with count)
- [x] Heart button server state (product cards + PDP)
- [x] Rename/delete wishlist UI
- [x] Social proof count (`GET /store/products/:id/wishlist-count`)
- [x] Guest route hardening
- [x] Product images in wishlist cards
- [x] JWT security (explicit `jwtSecret` guard)
- [x] Code simplification (-179 lines)

### E2E Testing ✅

- [x] 10 spec files, 40 tests (80 with Firefox)
- [x] Custom fixtures for API, auth, and wishlist setup

### Remaining

- No deferred phases. Remaining items are code review follow-ups — not feature work.

## Key references

- Original plans: [archived](../archive/) — `2026-02-22-wishlist-*.md`
