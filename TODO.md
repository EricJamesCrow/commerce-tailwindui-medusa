# TODO

> For feature status and project overview, see [README.md](README.md).
> For in-progress feature details, see [docs/features/](docs/features/).

## Code Review Follow-ups

### From PR #8

- [x] Migrate admin review drawer to `@medusajs/ui` primitives (Drawer, Button, Textarea, Label) for consistency with admin UI conventions
- [x] Validate `images[].url` hostname against storage provider domain, or switch to opaque upload IDs instead of raw URLs (security hardening)
- [x] Refactor `uploadReviewImages` server action to accept `FormData` instead of `File[]` for proper Server Action serialization
- [x] Add `data-testid` attributes to review components and migrate E2E selectors from Tailwind classes to stable `data-testid` selectors
- [x] Extract ReviewList lightbox state into a thin client wrapper so the list itself can be a server component
- [x] Add regex validation for Medusa IDs in E2E fixture SQL interpolation (e.g. `/^rev_[a-z0-9]+$/`)
- [x] Add fail-fast env var checks in E2E fixtures for CI environments
- [x] Rename `prev_img` ID prefix to `revi` on ReviewImage model (requires migration)
- [x] Revoke `URL.createObjectURL` blobs in ReviewForm on file remove and component cleanup
- [x] Add explicit `multer` to backend `package.json` dependencies (currently works via transitive dep from `@medusajs/medusa`)

### From Invoice Generation

- [x] Refactor `tryGenerateInvoicePdfStep` to call existing workflow steps instead of duplicating invoice creation, formatting, and rendering logic
- [x] TS2590 `as any` casts in `generate-invoice-pdf.ts` — documented with explanatory comments (Medusa WorkflowData union complexity, not removable)
- [x] Admin invoice widget (`order-invoice.tsx`) — replaced `window.open` with blob-based download for cross-origin admin deployments
- [x] Narrow catch clause in `get-or-create-invoice.ts` retry to only catch unique constraint violations, not all errors
- [x] Add input sanitization (Medusa ID format check) to storefront invoice proxy route (`app/api/orders/[id]/invoice/route.ts`)

### From PR #9

- [x] Strip `payment_sessions` from checkout cart serialization — only pass `client_secret` to client via dedicated server action (Finding #1: broad payment-session exposure)
- [x] Add Zod schema validation to checkout server actions for `email`, address payloads, `providerId`, and `data` params (Finding #2: no input validation at action boundaries)

### From PR #33 (Newsletter Signup)

- [ ] Replace HMAC bearer unsubscribe token with opaque server-stored nonce — current token embeds email in reversible base64url and is replayable for 30 days. PostHog pageview captures the full tokenized URL, leaking the token to analytics pipelines. Fix: store a one-time nonce on the subscriber record, invalidate on re-subscribe, and strip the token from the address bar via `window.history.replaceState` after the unsubscribe page loads.
- [ ] Email preferences page — currently the "manage your email preferences" link is hidden in email footers because no page exists. Two approaches: (1) for logged-in customers, add an email preferences section to `/account/settings` where they can toggle newsletter, order updates, and marketing emails; (2) for account-agnostic access, create a standalone `/email-preferences` page that accepts a signed token (same pattern as unsubscribe) and lets anyone with a valid link manage preferences for their email address without requiring an account. Ideal: support both — account settings for logged-in users, token-based page for email links. Wire the `legalLinks.preferences` config in the email footer to point to the appropriate URL.

### From PR #32 (Meilisearch Integration)

- [ ] Faceted search results page — the current `meilisearch-results.tsx` was reverted because it conflicts with the shared `(store)` layout (duplicate sort dropdown, nested grid). The proper approach: integrate Meilisearch faceted filters (collections, price range, availability) INTO the existing `(store)` layout components (`components/layout/search/collections.tsx`, `sort-filter-menu.tsx`, `mobile-filters.tsx`) rather than rendering a separate InstantSearch layout. The Cmd+K palette Meilisearch integration works correctly — only the search results page needs this redesign.
- [ ] Investigate `variant_prices` indexing — price range filter shows $0–$0 in Meilisearch results, suggesting variant prices may not be indexed correctly. Check whether `variants.prices.*` in the `useQueryGraphStep` query returns the expected amounts. May need to use `variants.calculated_price.*` with a `QueryContext` instead.

### From PR #29 (PostHog Integration)

- [x] Redact PII from `search_performed` event query field — normalize, truncate to 80 chars, and redact strings matching email/phone patterns before sending to PostHog
- [x] Enrich `product_added_to_cart` event with `product_id` and `price` — currently empty/zero because `addItem()` only receives `selectedVariantId`. Either pass product context from the calling component or accept a second fetch.

## Testing

- [ ] Discount / promo code UI — add a "Promo code" input to the checkout order summary (collapsible section below the line items). Use Medusa's `updateCart` with `promo_codes` to apply codes. Display applied discount as a removable chip/tag. The order summary already renders `discount_total` when present — this just needs the input to apply codes. Use TailwindPlus Ecommerce > Shopping Carts for input pattern reference. Server action: `applyPromoCode(cartId, code)` and `removePromoCode(cartId, code)`. Track: `promo_code_applied`, `promo_code_removed`, `promo_code_failed` events.
- [ ] Testing discounts (apply promo codes, verify discount display in checkout + order confirmation)
- [ ] Compare checkout page UI to TailwindUI components (ensure all checkout/order pages match TailwindUI patterns)
- [ ] Order details page — build using TailwindPlus Ecommerce > Page Examples > Order Detail Pages > "With large images and progress bars" component. Features: product images, order progress bar (Order placed → Processing → Shipped → Delivered), delivery address, shipping updates, billing summary with payment info. Wire to Medusa order data (`/account/orders/[id]`). The TailwindPlus component includes a full navbar with mega menus, footer, and billing section — adapt to use existing layout components.
- [x] Create `playwright.config.ts`
- [ ] Expand storefront Vitest coverage — add deterministic unit tests for `lib/medusa/transforms.ts`, `lib/analytics.ts` PII redaction, and `lib/validation.ts`
- [ ] E2E test: browse products → add to cart flow
- [x] Wishlist E2E test suite (40 tests across 10 spec files — guest, authenticated, heart-button, heart-state, sharing, import, transfer, nav-badge, rename-delete, social-proof; 80 total with Firefox)
- [x] Review E2E test suite (27 tests across 4 spec files — form, display, image-upload, lightbox; 54 total with Firefox)

## Infrastructure

- [x] Configure S3 File Provider for Medusa — Cloudflare R2 via `@medusajs/medusa/file-s3`, conditional on `S3_BUCKET`, E2E tests, Railway + Vercel env vars configured
- [x] Convert `<img>` tags to Next.js `<Image>` components
- [x] Convert monorepo to Turborepo with bun workspaces
- [x] Shared TypeScript tooling (`@repo/typescript`)
- [x] Enable React Compiler
- [ ] React Compiler optimization (audit component boundaries, measure compile rate, fix bailouts)
- [ ] **[PRIORITY] Expand CI/CD with Playwright smoke tests and preview/health checks** — keep the existing storefront/backend quality gates, then add a separate PR smoke job for critical user flows plus deployment/preview health validation before merge.
- [x] **[PRIORITY] Sentry deep integration audit** — comprehensive error capture across 44 files: checkout/cart/payment/auth storefront catches, all 13 backend subscribers, jobs, workflow steps, rate-limit infrastructure, user context enrichment (client + server), environment separation, 5xx-only proxy policy. Remaining: source maps/releases (Phase 3a), OTEL bridge research (Phase 3b), Sentry Logs/replay tuning/profiling (Phase 4).
- [ ] **[PRIORITY] PostHog deep integration audit** — verify all PostHog features are working in production: pageview autocapture, custom events (check all `AnalyticsEvents` are firing), session replay (verify recordings appear), feature flags (set up at least one flag to verify the pipeline), web analytics dashboard, funnels (checkout funnel, search-to-purchase funnel). Test the PostHog reverse proxy is working (events should appear even with ad blockers). Verify server-side events from the backend (order placed, review created, etc.) appear in PostHog.
- [ ] **[PRIORITY] Fix Vercel Sentry env config** — production build logs show `sentry-cli` failing because `SENTRY_PROJECT` is stored as `crowcommerce-storefront\n` and the current `SENTRY_ORG` / `SENTRY_PROJECT` pairing does not resolve to a valid Sentry project. Confirm the correct Sentry org/project slugs for CrowCommerce, remove trailing newlines from both env vars in Vercel, then verify the next production build completes release creation and sourcemap upload without `Project not found` or `invalid value for --project` errors.
- [ ] Configure Medusa webhooks for cache revalidation
- [ ] Verify catalog revalidation end-to-end in production — after a Medusa product/collection create or update, confirm the webhook reaches `/api/revalidate`, `revalidateTag(TAGS.products|collections)` invalidates both the outer cached catalog loaders and the nested tagged fetches, and the storefront reflects the change without waiting for TTL expiry.
- [ ] Update `DEFAULT_NAVIGATION` with real store categories
- [ ] Upgrade Turborepo: `bunx @turbo/codemod@latest update`
- [x] Set up PostHog reverse proxy — Next.js rewrites proxy `/api/ph/:path*` to `us.i.posthog.com` (avoids ad blockers that target `/ingest`). See [PostHog Next.js proxy docs](https://posthog.com/docs/advanced/proxy/nextjs).
- [ ] Switch PostHog proxy to managed proxy — the Next.js rewrite approach is vulnerable to DNS-level CNAME uncloaking (NextDNS, Pi-hole, ISP blockers follow the CNAME chain to `posthog.com` and block before the rewrite runs). PostHog's managed proxy uses randomized hash subdomains on rotating AWS infra that aren't on common blocklists. Also eliminates the rewrite config, `skipTrailingSlashRedirect` workaround, and Vercel edge invocations spent on analytics proxying — replace it all with one DNS CNAME record. Requires PostHog Teams+ plan. See [PostHog managed proxy docs](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy).

## UI Consistency

- [ ] Audit codebase for features not using the `NotificationProvider` / `useNotification()` toast system — identify server actions and user-facing mutations that silently succeed/fail without toast feedback and wire them up for consistent UX
- [ ] Audit storefront components against the TailwindPlus component catalog (`/Users/itsjusteric/CrowCommerce/Resources/TailwindUI/tailwindplus-components.json`) — identify pages and sections using custom markup where a TailwindPlus UI block already exists (e.g., product pages, checkout steps, account settings, error pages). Reference the full catalog at https://tailwindcss.com/plus/ui-blocks/documentation

## Security Audits

- [ ] Run Codex security audit on custom modules — prioritize by attack surface: (1) **Invoice module** (financial data + PDF generation + public download routes), (2) **Review module** (user image uploads + user-generated content rendering), (3) **Wishlist module** (public endpoints like `/store/products/:id/wishlist-count`, JWT sharing tokens, guest routes). Focus on IDOR, SSRF in image uploads, JWT misconfiguration, and input validation gaps. Multiple passes recommended.

## Evaluate

- [ ] [Buttondown](https://buttondown.com/) for newsletter — evaluate as a potential upgrade/replacement for the current newsletter infrastructure. Supports RSS-to-email, markdown authoring, API-first design, paid subscriptions, and analytics. Could simplify the newsletter stack vs. rolling custom with Resend.

## Deferred Features

- [ ] Re-enable re-order after checkout hardening — keep it disabled until payment confirmation no longer relies on cross-step stored Stripe refs and reorder E2E covers the full `reorder -> payment -> confirmed order` path.
- [ ] Cookie consent banner — use TailwindPlus Marketing > Banners > "Privacy notice left-aligned" component, rendered inside a Headless UI `<Dialog>` so it behaves as a modal overlay on first visit. Persist consent in a cookie to avoid showing again. Track: `cookie_consent_accepted`, `cookie_consent_declined` events.
- [ ] Sticky add-to-cart bar on product pages — fixed to the bottom of the viewport, appears on scroll past the main add-to-cart button. Use TailwindPlus Marketing > Banners > full-width banner variant as the base layout. Show product name, selected variant, price, and "Add to Cart" button. Hide when the main add-to-cart button is back in viewport (IntersectionObserver).
- [ ] Search-focused layout option — brainstorm an alternative navbar/layout where search is the primary interaction (like the [Meilisearch ecommerce demo](https://github.com/meilisearch/ecommerce-demo)). Instant faceted filtering on `/products` and `/search` with the search bar front-and-center. This could be a swappable layout style alongside the current TailwindUI sidebar layout. Reference the demo for UX patterns (instant results, facet chips, filter counts).
- [ ] Express checkout (Apple Pay / Google Pay) — composite flow that chains email → address → shipping → payment → order completion in one step. Requires Stripe `PaymentRequestButton` or `ExpressCheckoutElement`. `express-checkout.tsx` component exists but needs implementation. Track with: `express_checkout_started`, `express_checkout_completed`, `express_checkout_failed` events.

## Known Limitations

- [x] Browser back button broken after navigating to a product page — fixed by using `router.replace` for variant URL updates to prevent back button cycling
- [ ] `checkoutUrl` on Cart type is always empty string
- [ ] Image dimensions are 0x0 (Medusa doesn't provide them)
- [ ] `descriptionHtml` is same as plain description (no HTML from Medusa)
