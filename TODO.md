# TODO

> For feature status and project overview, see [README.md](README.md).
> For in-progress feature details, see [docs/features/](docs/features/).

## Codex Launch Tracks

Use this section when running parallel launch-hardening work in separate Codex threads and separate git worktrees.

If a user says `TODO.md Track 1`, `TODO.md Track 2`, `TODO.md Track 3`, or `TODO.md Track 4`, the agent should:

1. Read this section and execute only the requested track.
2. Create a clean Graphite branch before repo-tracked edits.
3. Treat the track as an implementation task, not a planning task.
4. Stay within the listed ownership boundaries unless blocked.
5. Run the listed verification before considering the track complete.

### Shared Execution Rules

- Work from a clean worktree so unrelated local changes are not bundled into the branch.
- Use Graphite for branch creation and submission:
  - `gt create -a -m "<type>: <track description>"`
  - `gt submit --stack --no-interactive`
- Do not modify files owned by another active track unless the user explicitly asks to merge scopes.
- Update this `TODO.md` section and any relevant feature doc if the track meaningfully changes scope or completion criteria.
- Before submit, run:
  - `cd storefront && bun run prettier:check`
  - `cd backend && bun run prettier:check`
  - `cd storefront && bun run test:e2e:smoke` with the full stack running
  - `cr review`

### Track 1: Search Unification

- Goal: make storefront search production-ready by unifying the search results page and Cmd+K palette behind one consistent architecture when Meilisearch is enabled, while preserving Medusa fallback when it is not.
- Why this is launch-critical:
  - Current architecture is split between Medusa REST on `/search` and Meilisearch in Cmd+K.
  - Price facets are not trustworthy until `variant_prices` indexing is fixed.
- Primary files:
  - `storefront/app/(store)/search/page.tsx`
  - `storefront/components/layout/search/collections.tsx`
  - `storefront/components/layout/search/mobile-filters.tsx`
  - `storefront/components/layout/search/sort-filter.tsx`
  - `storefront/components/search-command/use-search.tsx`
  - `storefront/lib/meilisearch.ts`
  - `backend/src/workflows/sync-products.ts`
  - `backend/src/modules/meilisearch/service.ts`
- Reference backlog/specs:
  - `TODO.md` → "From PR #32 (Meilisearch Integration)"
  - `docs/features/search.md`
  - `docs/superpowers/plans/2026-03-21-meilisearch.md`
- Required outcomes:
  - `/search` uses Meilisearch when Meilisearch is enabled.
  - Cmd+K and `/search` return results from the same source of truth when Meilisearch is enabled.
  - Facets are integrated into the existing `(store)` layout instead of rendering a second competing search layout.
  - `variant_prices` are indexed correctly enough for price filtering/sorting to work.
  - Medusa fallback still works when Meilisearch env vars are absent.
- Verification:
  - Manual: verify Cmd+K and `/search?q=...` return consistent product sets.
  - Manual: verify collection facet, availability facet, and price range work.
  - Manual: verify store still works with Meilisearch env vars disabled.
  - Automated: run relevant storefront tests plus smoke suite.
- Do not pull into this track:
  - Search-focused alternative layout experiments.
  - Personalization or AI search work.

### Track 2: Reviews Hardening + Phase 3 Launch Slice

- Goal: fix review trust/safety issues and complete the minimum viable part of Phase 3 needed for launch confidence.
- Why this is launch-critical:
  - The backend currently auto-approves reviews, which conflicts with the intended moderation model.
  - Verified purchase is the most important missing review trust signal.
- Primary files:
  - `backend/src/api/store/reviews/route.ts`
  - `backend/src/api/store/products/[id]/reviews/route.ts`
  - `backend/src/modules/product-review/service.ts`
  - `backend/src/workflows/create-review.ts`
  - `backend/src/admin/routes/reviews/page.tsx`
  - `storefront/lib/medusa/reviews.ts`
  - `storefront/components/reviews/ProductReviews.tsx`
  - `storefront/components/reviews/ReviewForm.tsx`
- Reference backlog/specs:
  - `docs/features/product-reviews.md`
  - `TODO.md` → review-related follow-ups
- Required outcomes:
  - Review submission behavior matches the intended product policy.
  - If moderation is intended, new reviews should default to `pending` and require admin approval.
  - Verified purchase linkage exists and drives a storefront badge or explicit trust indicator.
  - Review submission, moderation, and display still work after the change.
- Preferred scope for tonight:
  - Do the moderation fix first.
  - Do verified purchase linking second.
  - Defer admin full-text review search and review editing unless time remains.
- Verification:
  - Manual: submit a review and verify status/default moderation path.
  - Manual: approve a pending review in admin and verify storefront visibility.
  - Manual: verify purchased-product review shows verified purchase state if implemented.
  - Automated: run review E2E coverage plus smoke suite.
- Do not pull into this track:
  - General search improvements.
  - Newsletter/security work unrelated to reviews.

### Track 3: CI / Deploy / Production Gates

- Goal: finish the quality gates and production verification work that reduces launch risk for every other track.
- Why this is launch-critical:
  - CI and deploy verification are still partial.
  - Sentry production env setup is known-bad.
  - Catalog revalidation needs production-level verification.
- Primary files:
  - `.github/workflows/ci.yml`
  - `backend/package.json`
  - `backend/.prettierrc`
  - `backend/.prettierignore`
  - `storefront/playwright.config.ts`
  - `storefront/app/api/revalidate/route.ts`
  - `storefront/lib/medusa/index.ts`
  - `storefront/next.config.ts`
  - `backend/medusa-config.ts`
  - `SETUP.md`
- Reference backlog/specs:
  - `TODO.md` → Infrastructure priority items
  - `docs/superpowers/plans/2026-03-24-ci-cd-quality-gates.md`
  - `docs/superpowers/plans/2026-03-25-playwright-smoke-ci.md`
- Required outcomes:
  - CI runs the intended quality gates consistently.
  - Playwright smoke coverage is part of the launch path.
  - Sentry production env/release configuration is corrected and documented.
  - Catalog revalidation path is verified end-to-end against the real deployment assumptions.
- Verification:
  - Manual: trigger CI on the branch and confirm green checks.
  - Manual: verify a product or collection update reaches `/api/revalidate` and refreshes storefront content.
  - Manual: confirm production build no longer fails on Sentry project/env config.
- Do not pull into this track:
  - Feature work unrelated to release safety.
  - UI polish work.

### Track 4: Security / Privacy Hardening

- Goal: address the launch-blocking security and privacy issues already identified in the backlog and run a focused audit pass on the highest-risk custom modules.
- Why this is launch-critical:
  - Newsletter unsubscribe links currently use a reversible/replayable token pattern.
  - Invoice, review, and wishlist modules are the highest-risk custom surfaces.
- Primary files:
  - `backend/src/api/store/newsletter/`
  - `backend/src/modules/newsletter/`
  - `storefront/app/`
  - `backend/src/modules/invoice/`
  - `backend/src/modules/product-review/`
  - `backend/src/modules/wishlist/`
  - Any directly-related tests/docs touched by the fix
- Reference backlog/specs:
  - `TODO.md` → newsletter follow-ups
  - `TODO.md` → security audits
- Required outcomes:
  - Replace the HMAC bearer unsubscribe token with an opaque server-stored nonce.
  - Strip tokenized unsubscribe params from the browser URL after load if the page still needs to read them client-side.
  - Run a focused security pass on invoice, review, and wishlist modules and fix any concrete P0/P1 issues found.
- Verification:
  - Manual: unsubscribe link works once and does not leak a reusable token in the URL after page load.
  - Manual: re-subscribe invalidates prior unsubscribe nonce if applicable.
  - Manual: security review notes are captured in docs or the PR description.
- Do not pull into this track:
  - Broad refactors with no concrete launch-risk reduction.

### Suggested Parallelization

- Safe to run in parallel:
  - Track 1 with Track 2
  - Track 1 with Track 3
  - Track 2 with Track 3
  - Track 4 with any other track, as long as file ownership stays clear
- Use care if both tracks need the same files:
  - Track 1 owns search layout and Meilisearch files
  - Track 2 owns review routes, review module, and review storefront/admin UI
  - Track 3 owns CI, deploy config, and release verification files
  - Track 4 owns newsletter/security-sensitive module fixes unless a narrower owner is explicitly chosen

### Recommended Order

1. Start Track 3 immediately so CI and smoke coverage protect the other tracks.
2. Start Track 2 in parallel because review trust is the sharpest user-facing launch risk.
3. Start Track 1 once the quality gates are in place.
4. Run Track 4 as a focused audit/fix pass while the other tracks are in flight.

### Explicit Deferrals For Launch

Do not let these block the client fork tonight unless the user explicitly reprioritizes them:

- Re-order re-enable
- Promo code UI
- Express checkout completion
- Search-focused alternative layout experiments
- React Compiler optimization pass
- General UI consistency cleanup

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
- [x] Configure automatic storefront catalog revalidation from backend product and collection events
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
