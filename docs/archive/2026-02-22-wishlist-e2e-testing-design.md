# Wishlist E2E Testing Design

## Overview

Full-stack E2E test suite for the wishlist feature using Playwright. Tests run a real browser against the running Next.js storefront and Medusa backend, covering guest, authenticated, and shared wishlist flows.

## Decisions

- **Scope:** Full-stack E2E (real browser + real backend)
- **Personas:** Guest, authenticated customer, shared link recipient
- **Test data:** Seed script for baseline data + API-based setup in fixtures
- **Organization:** Page-centric (one spec file per surface area)
- **Infrastructure:** Full Playwright setup with config, fixtures, helpers

## Infrastructure

### Playwright Config (`storefront/playwright.config.ts`)

- Base URL: `http://localhost:3000`
- Browsers: Chromium (primary), Firefox (cross-browser)
- Timeouts: 30s action, 60s test
- Screenshots on failure, trace on first retry
- HTML reporter
- Web server: auto-start `bun run dev` from root (wait for port 3000)
- 1 retry on CI, 0 locally

### Directory Structure

```
storefront/tests/e2e/
├── fixtures/
│   ├── auth.fixture.ts      # Authenticated browser context via storageState
│   ├── api.fixture.ts       # Direct Medusa API client for data setup/teardown
│   └── wishlist.fixture.ts  # Create wishlists, add items, generate share tokens
├── wishlist/
│   ├── guest.spec.ts
│   ├── authenticated.spec.ts
│   ├── heart-button.spec.ts
│   ├── sharing.spec.ts
│   ├── import.spec.ts
│   └── transfer.spec.ts
└── helpers/
    └── selectors.ts         # Shared CSS/test-id selectors
```

### Auth Fixture

Login once via Medusa auth API, save cookies/session to a JSON file using Playwright's `storageState`. Reuse across all authenticated tests. Guest tests use a fresh context with no stored state.

## Test Coverage

### guest.spec.ts — Guest Wishlist (6 tests)

| Test | Verifies |
|------|----------|
| Add item via heart on PDP | Heart click sets cookie, heart fills solid red |
| Wishlist persists across navigation | Add item, navigate away, return, heart still filled |
| Remove item from wishlist | Filled heart click reverts to outline |
| Wishlist page shows items | Add items, navigate to wishlist page, items in grid |
| Empty state displayed | No items shows "Browse Products" prompt |
| Duplicate variant handled | Re-clicking filled heart doesn't error |

### authenticated.spec.ts — Customer Wishlist CRUD (8 tests)

| Test | Verifies |
|------|----------|
| Create named wishlist | "New Wishlist" modal, name input, tab appears |
| View wishlist items | Image, title, variant, price, remove button displayed |
| Remove item | Click X, item disappears |
| Switch between wishlists | Tab click, content updates |
| Rename wishlist | Name updates in UI |
| Delete wishlist | Tab removed |
| Empty state | "Browse Products" message |
| Add to cart from wishlist | Cart updates on button click |

### heart-button.spec.ts — Heart Toggle (5 tests)

| Test | Verifies |
|------|----------|
| Heart appears on PDP | Icon rendered |
| Toggle on click | Outline to solid red, and back |
| Loading state during action | Button disabled during server action |
| Works for authenticated users | Adds to customer wishlist |
| Works for guest users | Creates guest wishlist, sets cookie |

### sharing.spec.ts — Share Links (5 tests)

| Test | Verifies |
|------|----------|
| Generate share link | Share button produces URL |
| Read-only shared view | Items visible, no edit controls |
| Shows name and items | Correct data displayed |
| Unauthenticated sees sign-in prompt | Guest gets CTA, no import button |
| Expired token shows error | Graceful error for old tokens |

### import.spec.ts — Import Shared Wishlist (3 tests)

| Test | Verifies |
|------|----------|
| Import creates new wishlist | "(imported)" suffix, new wishlist in account |
| Imported items match source | Count and products match original |
| Import hidden from guests | Sign-in prompt instead of import button |

### transfer.spec.ts — Guest-to-Customer Transfer (4 tests)

| Test | Verifies |
|------|----------|
| Transfer on login | Guest items appear in customer wishlist |
| Transfer on signup | Guest items appear after account creation |
| Cookie cleared after transfer | Guest wishlist cookie removed |
| Existing wishlist preserved | Customer's pre-existing wishlist unaffected |

## Total: ~31 tests across 6 spec files

## Test Data Strategy

1. **Baseline:** Rely on seeded products and collections from `backend/src/scripts/seed.ts`
2. **Per-test setup:** Fixtures call Medusa Store/Admin API directly to create test customers, wishlists, and items
3. **Cleanup:** Best-effort teardown in `afterAll` — delete test wishlists and customers created during tests
4. **Isolation:** Each spec file uses its own test customer to avoid cross-test interference
