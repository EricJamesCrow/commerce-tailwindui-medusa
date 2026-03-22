# TODO

> For feature status and project overview, see [README.md](README.md).
> For in-progress feature details, see [docs/features/](docs/features/).

## Code Review Follow-ups

### From PR #8

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

### From Invoice Generation

- [x] Refactor `tryGenerateInvoicePdfStep` to call existing workflow steps instead of duplicating invoice creation, formatting, and rendering logic
- [x] TS2590 `as any` casts in `generate-invoice-pdf.ts` — documented with explanatory comments (Medusa WorkflowData union complexity, not removable)
- [x] Admin invoice widget (`order-invoice.tsx`) — replaced `window.open` with blob-based download for cross-origin admin deployments
- [x] Narrow catch clause in `get-or-create-invoice.ts` retry to only catch unique constraint violations, not all errors
- [x] Add input sanitization (Medusa ID format check) to storefront invoice proxy route (`app/api/orders/[id]/invoice/route.ts`)

### From PR #9

- [ ] Strip `payment_sessions` from checkout cart serialization — only pass `client_secret` to client via dedicated server action (Finding #1: broad payment-session exposure)
- [ ] Add Zod schema validation to checkout server actions for `email`, address payloads, `providerId`, and `data` params (Finding #2: no input validation at action boundaries)

### From PR #33 (Newsletter Signup)

- [ ] Replace HMAC bearer unsubscribe token with opaque server-stored nonce — current token embeds email in reversible base64url and is replayable for 30 days. PostHog pageview captures the full tokenized URL, leaking the token to analytics pipelines. Fix: store a one-time nonce on the subscriber record, invalidate on re-subscribe, and strip the token from the address bar via `window.history.replaceState` after the unsubscribe page loads.
- [ ] Email preferences page — currently the "manage your email preferences" link is hidden in email footers because no page exists. Two approaches: (1) for logged-in customers, add an email preferences section to `/account/settings` where they can toggle newsletter, order updates, and marketing emails; (2) for account-agnostic access, create a standalone `/email-preferences` page that accepts a signed token (same pattern as unsubscribe) and lets anyone with a valid link manage preferences for their email address without requiring an account. Ideal: support both — account settings for logged-in users, token-based page for email links. Wire the `legalLinks.preferences` config in the email footer to point to the appropriate URL.

### From PR #29 (PostHog Integration)

- [ ] Redact PII from `search_performed` event query field — normalize, truncate to 80 chars, and redact strings matching email/phone patterns before sending to PostHog
- [ ] Enrich `product_added_to_cart` event with `product_id` and `price` — currently empty/zero because `addItem()` only receives `selectedVariantId`. Either pass product context from the calling component or accept a second fetch.

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

- [x] Configure S3 File Provider for Medusa — Cloudflare R2 via `@medusajs/medusa/file-s3`, conditional on `S3_BUCKET`, E2E tests, Railway + Vercel env vars configured
- [x] Convert `<img>` tags to Next.js `<Image>` components
- [x] Convert monorepo to Turborepo with bun workspaces
- [x] Shared TypeScript tooling (`@repo/typescript`)
- [x] Enable React Compiler
- [ ] React Compiler optimization (audit component boundaries, measure compile rate, fix bailouts)
- [ ] Set up CI/CD (GitHub Actions)
- [ ] Configure Medusa webhooks for cache revalidation
- [ ] Update `DEFAULT_NAVIGATION` with real store categories
- [ ] Upgrade Turborepo: `bunx @turbo/codemod@latest update`
- [x] Set up PostHog reverse proxy — Next.js rewrites proxy `/api/ph/:path*` to `us.i.posthog.com` (avoids ad blockers that target `/ingest`). See [PostHog Next.js proxy docs](https://posthog.com/docs/advanced/proxy/nextjs).
- [ ] Switch PostHog proxy to managed proxy — the Next.js rewrite approach is vulnerable to DNS-level CNAME uncloaking (NextDNS, Pi-hole, ISP blockers follow the CNAME chain to `posthog.com` and block before the rewrite runs). PostHog's managed proxy uses randomized hash subdomains on rotating AWS infra that aren't on common blocklists. Also eliminates the rewrite config, `skipTrailingSlashRedirect` workaround, and Vercel edge invocations spent on analytics proxying — replace it all with one DNS CNAME record. Requires PostHog Teams+ plan. See [PostHog managed proxy docs](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy).

## UI Consistency

- [ ] Audit codebase for features not using the `NotificationProvider` / `useNotification()` toast system — identify server actions and user-facing mutations that silently succeed/fail without toast feedback and wire them up for consistent UX
- [ ] Audit storefront components against the TailwindPlus component catalog (`/Users/itsjusteric/CrowCommerce/Resources/TailwindUI/tailwindplus-components.json`) — identify pages and sections using custom markup where a TailwindPlus UI block already exists (e.g., product pages, checkout steps, account settings, error pages). Reference the full catalog at https://tailwindcss.com/plus/ui-blocks/documentation

## Deferred Features

- [ ] Cookie consent banner — use TailwindPlus Marketing > Banners > "Privacy notice left-aligned" component, rendered inside a Headless UI `<Dialog>` so it behaves as a modal overlay on first visit. Persist consent in a cookie to avoid showing again. Track: `cookie_consent_accepted`, `cookie_consent_declined` events.
- [ ] Sticky add-to-cart bar on product pages — fixed to the bottom of the viewport, appears on scroll past the main add-to-cart button. Use TailwindPlus Marketing > Banners > full-width banner variant as the base layout. Show product name, selected variant, price, and "Add to Cart" button. Hide when the main add-to-cart button is back in viewport (IntersectionObserver).
- [ ] Express checkout (Apple Pay / Google Pay) — composite flow that chains email → address → shipping → payment → order completion in one step. Requires Stripe `PaymentRequestButton` or `ExpressCheckoutElement`. `express-checkout.tsx` component exists but needs implementation. Track with: `express_checkout_started`, `express_checkout_completed`, `express_checkout_failed` events.

## Known Limitations

- [x] Browser back button broken after navigating to a product page — fixed by using `router.replace` for variant URL updates to prevent back button cycling
- [ ] `checkoutUrl` on Cart type is always empty string
- [ ] Image dimensions are 0x0 (Medusa doesn't provide them)
- [ ] `descriptionHtml` is same as plain description (no HTML from Medusa)
