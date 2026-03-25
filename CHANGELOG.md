# Changelog

All notable changes to CrowCommerce are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Abandoned cart recovery emails with HMAC-signed recovery links
- Product thumbnail images in email templates

## [2026-03-25]

### Fixed
- PostHog `search_performed` event: PII redaction applied before truncation — email and phone patterns replaced with `[email]`/`[phone]` placeholders, then query truncated to 80 chars (prevents partial tokens from surviving the slice boundary)
- PostHog `product_added_to_cart` event: `product_id` and `price` now populated from the cart line returned by `addToCart()` — no longer sends empty string / zero

### Security
- Checkout payment session hardening: strip `payment_sessions[].data` (including Stripe `client_secret`) from RSC payload; dedicated `getPaymentClientSecret(cartId, providerId?)` server action returns only the secret over the secure server-action channel
- Zod validation at checkout server action boundaries: `setCartEmail` (email normalization + format), `setCartAddresses` (full address schema for shipping + billing), `initializePaymentSession` (provider ID format, payment data shape)
- `applyExpressCheckoutData` now scopes secret retrieval to `STRIPE_PROVIDER_ID` to prevent multi-provider session ordering ambiguity

## [2026-03-24]

### Security
- HTTP security headers: HSTS (2yr + preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` via `next.config.ts`
- Content Security Policy with per-request nonce (`'strict-dynamic'`) via `proxy.ts`, covering Stripe, Sentry, Medusa backend, Meilisearch, and PostHog (proxied same-origin)

## [2026-03-16]

### Added
- Order lifecycle emails: shipping confirmation, order canceled, refund confirmation, admin new order alert

## [2026-03-15]

### Added
- Auth & admin emails: password reset, admin invite, customer welcome
- Auth security hardening: password reset flow, Redis rate limiting, password validation

## [2026-03-14]

### Added
- Email infrastructure foundation: Resend provider, TailwindUI-themed components, order confirmation template

## [2026-02-27]

### Added
- Product quick view modal on product grid

## [2026-02-24]

### Added
- Production deployment (Vercel + Railway)
- TailwindUI seed data (65 products, 6 collections)

## [2026-02-23]

### Added
- Stripe checkout flow (5-step, Payment Element, saved cards, guest checkout)

## [2026-02-22]

### Added
- Wishlist system (guest + authenticated, sharing, multiple lists)
- Product reviews Phase 2 (admin responses, review images, lightbox)
- Wishlist Phase 2 polish (nav badge, server state, rename/delete, social proof)

## [2026-02-21]

### Added
- Product reviews (5-star ratings, admin moderation, storefront UI)

## [2026-02-20]

### Added
- Customer accounts (signup, login, signout, profile, orders, addresses)

## [2026-02-18]

### Added
- Medusa v2 integration (catalog + cart, replacing Shopify backend)
