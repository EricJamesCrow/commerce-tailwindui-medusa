# TODO

## Deferred Features (Phase 2+)

- [x] Customer accounts — see [implementation phases](#customer-accounts-implementation) below
- [x] Checkout flow (5-step: email → address → shipping → payment → review with Stripe Payment Element)
- [ ] Multi-region / multi-currency support
- [ ] Collections/categories (storefront collection pages, Medusa nested category tree, navigation integration)
- [x] Wishlist / saved items
- [ ] CMS pages (`getPage`/`getPages` return stubs)

## Product Reviews

### Completed (Phase 1)

- [x] Product reviews backend module (model, service, workflows, API routes)
- [x] Storefront UI (form, list, summary, star ratings, Suspense streaming)
- [x] Admin moderation table with bulk actions
- [x] Denormalized `ReviewStats` table — pre-calculated stats refreshed on write
- [x] Default review status "pending" (requires admin approval)
- [x] Soft deletes on review rollback
- [x] Event emission (`product_review.created`, `product_review.updated`)

### Phase 2: Admin Responses & Review Images

- [x] `ProductReviewResponse` entity — admin replies to reviews (full CRUD)
- [x] `ProductReviewImage` entity — image upload endpoint for review photos
- [x] Display admin responses on storefront review list
- [x] Review image lightbox with prev/next navigation
- [x] Admin response management drawer (create/edit/delete)
- [x] Image upload UI in review form dialog (max 3, JPEG/PNG/WebP)

### Code Review Follow-ups (from PR #8)

- [ ] Migrate admin review drawer to `@medusajs/ui` primitives (Drawer, Button, Textarea, Label) for consistency with admin UI conventions
- [ ] Validate `images[].url` hostname against storage provider domain, or switch to opaque upload IDs instead of raw URLs (security hardening)
- [ ] Refactor `uploadReviewImages` server action to accept `FormData` instead of `File[]` for proper Server Action serialization
- [ ] Add `data-testid` attributes to review components and migrate E2E selectors from Tailwind classes to stable `data-testid` selectors
- [ ] Extract ReviewList lightbox state into a thin client wrapper so the list itself can be a server component
- [ ] Add regex validation for Medusa IDs in E2E fixture SQL interpolation (e.g. `/^rev_[a-z0-9]+$/`)
- [ ] Add fail-fast env var checks in E2E fixtures for CI environments
- [ ] Rename `prev_img` ID prefix to `revi` on ReviewImage model (requires migration)
- [ ] Revoke `URL.createObjectURL` blobs in ReviewForm on file remove and component cleanup
- [ ] Add explicit `multer` to backend `package.json` dependencies (currently works via transitive dep from `@medusajs/medusa`)

### Code Review Follow-ups (from PR #9)

- [ ] Strip `payment_sessions` from checkout cart serialization — only pass `client_secret` to client via dedicated server action (Finding #1: broad payment-session exposure)
- [ ] Add Zod schema validation to checkout server actions for `email`, address payloads, `providerId`, and `data` params (Finding #2: no input validation at action boundaries)

### Phase 3: Verified Purchase & Search

- [ ] Order linking (`order_id`, `order_line_item_id`) for verified purchase badge
- [ ] Full-text search on review content + name in admin
- [ ] Review editing (upsert pattern — one review per customer per product)

## Wishlist

### Completed

- [x] Wishlist backend module (models, service, migration, module links)
- [x] Workflow steps (10) with compensation for saga rollback
- [x] Workflows (6): create, add/delete item, delete, update, transfer
- [x] Customer API routes (8 endpoints) with Zod validation and ownership checks
- [x] Guest API routes (4 endpoints) with cookie-based tracking
- [x] Shared wishlist routes (JWT sharing with 7-day expiry, import/clone)
- [x] Admin wishlist count widget on product detail pages
- [x] Storefront server actions (12 functions) with cache tags and revalidation
- [x] Auth integration (transfer on login/signup, cleanup on signout)
- [x] Heart toggle button component (product cards and PDP)
- [x] Account wishlist page with multi-tab navigation, grid, empty state, share, create
- [x] Shared wishlist page with read-only view and import

### Phase 2: Polish

- [x] Nav badge — heart icon in header with item count, links to `/account/wishlist`, mobile menu entry
- [x] Heart button server state — product cards pass state from server, PDP auto-checks on mount via server action
- [x] Rename/delete wishlist UI — actions dropdown with rename dialog and delete confirmation
- [x] Store product wishlist count route — `GET /store/products/:id/wishlist-count` for social proof ("X people saved this")
- [x] Guest route hardening — `GET /store/wishlists/:id` now filters by `customer_id: null`; guest item routes also verify guest ownership
- [x] Fix `cookies()` inside `"use cache"` crash — `getWishlists()` and `getWishlist()` used `cookies()` inside `"use cache"` scope, crashing product pages after adding to wishlist. Removed incompatible cache directives.
- [x] Product images in wishlist cards — TailwindUI card design with variant/product thumbnails
- [x] JWT security — explicit `jwtSecret` guard on all 3 JWT-using routes (share, shared view, import)
- [x] Code simplification — extracted shared helpers (`verifyShareToken`, `requireGuestWishlist`, `requireSalesChannelId`), merged duplicate Zod schemas, consolidated auth middleware, added `wishlistMutation` helper on storefront. Net -179 lines.

## Content & Communications

- [ ] Order detail page — `/account/orders/[id]` storefront route (email "View your order" link currently 404s)
- [ ] Integrate Payload CMS — product content management (descriptions, rich media, landing pages)
- [ ] Abandoned cart recovery emails (Resend)
- [ ] Generate and send invoices (Resend)
- [ ] Newsletter signup and campaigns (Resend)

## Commerce Features

- [ ] Re-order — allow customers to re-order previous purchases
- [ ] Personalized products — custom text, images, or options per product
- [ ] Add product category images (beyond collection images)

## Agentic Commerce

- [ ] AI-powered product recommendations (conversational shopping assistant)
- [ ] Natural language search and product discovery
- [ ] Automated cart building from customer intent ("I need an outfit for a summer wedding")
- [ ] Personalized re-order suggestions based on purchase history
- [ ] AI-assisted customer support (order status, returns, FAQ)

## Completed

- [x] Harden cart infrastructure — secure cookies, auth headers, error handling, input validation
- [x] Replace raw `cookies()` calls with `lib/medusa/cookies.ts` utility
- [x] Add centralized Medusa SDK error formatting (`lib/medusa/error.ts`)
- [x] Pass auth headers to all cart SDK operations (infrastructure for customer accounts)
- [x] Revalidate cache on error to re-sync optimistic state (`finally` blocks)
- [x] Pass `lineItemId` directly in delete button (skip extra `getCart()` call)
- [x] Clear stale cart cookies on retrieval failure
- [x] Expand `CART_FIELDS` with `*promotions,+shipping_methods.name`
- [x] Fix global input focus styling — removed `outline: none !important` override in `globals.css` breaking all TailwindUI outline/ring utilities; standardized all inputs to TailwindUI v4 outline pattern
- [x] Product Quick View modal (hover overlay on product grid, TailwindPlus dialog with color/size pickers, add-to-cart, wishlist heart)

## Testing

- [ ] Testing discounts (apply promo codes, verify discount display in checkout + order confirmation)
- [ ] Compare checkout page UI to TailwindUI components (ensure all checkout/order pages match TailwindUI patterns)
- [ ] Create `vitest.config.ts`
- [x] Create `playwright.config.ts`
- [ ] Unit tests for `lib/medusa/transforms.ts`
- [ ] E2E test: browse products → add to cart flow
- [x] Wishlist E2E test suite (40 tests across 10 spec files — guest, authenticated, heart-button, heart-state, sharing, import, transfer, nav-badge, rename-delete, social-proof; 80 total with Firefox)
- [x] Review E2E test suite (27 tests across 4 spec files — form, display, image-upload, lightbox; 54 total with Firefox)

## Infrastructure

- [ ] Configure S3 File Provider for Medusa — replace local file storage with S3-compatible provider (AWS S3, DigitalOcean Spaces, MinIO, etc.) for product images, review images, and other uploads. See [Medusa S3 File Provider docs](https://docs.medusajs.com/resources/infrastructure-modules/file/s3)
- [x] Convert `<img>` tags to Next.js `<Image>` components
- [x] Convert monorepo to Turborepo with bun workspaces
- [x] Shared TypeScript tooling (`@repo/typescript`)
- [x] Enable React Compiler
- [ ] React Compiler optimization (audit component boundaries, measure compile rate, fix bailouts)
- [ ] Set up CI/CD (GitHub Actions)
- [ ] Configure Medusa webhooks for cache revalidation
- [ ] Update `DEFAULT_NAVIGATION` with real store categories

## Customer Accounts (Completed)

- [x] Auth data layer (signup, login, signout, retrieveCustomer, transferCart)
- [x] Auth UI (login/register pages with Server Actions)
- [x] Account pages (profile, orders, addresses with CRUD)
- [x] Auth-aware cart + navigation (cart transfer, account dropdown, route protection)

## Auth Security (from Stack 2 audit)

- [x] Password reset page — `/reset-password` storefront route accepting `token` and `email` query params (email "Reset Password" button currently links to nonexistent page)
- [x] Rate limiting on auth endpoints — prevent brute-force attacks on login, signup, and password reset (consider `express-rate-limit` or Medusa middleware)
- [x] Password complexity validation — enforce minimum length (8+ chars) on signup form and server action

## Known Limitations

- [x] Browser back button broken after navigating to a product page — fixed by using `router.replace` for variant URL updates to prevent back button cycling
- [ ] `checkoutUrl` on Cart type is always empty string
- [ ] Image dimensions are 0x0 (Medusa doesn't provide them)
- [ ] `descriptionHtml` is same as plain description (no HTML from Medusa)
