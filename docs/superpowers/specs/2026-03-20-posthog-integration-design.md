# PostHog Analytics Integration — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**ADR:** [docs/decisions/2026-03-20-posthog-unified-analytics.md](../../decisions/2026-03-20-posthog-unified-analytics.md)

## Context

CrowCommerce is a Next.js 16 + Medusa v2 monorepo. The app is heavily RSC-based — most conversion events (add to cart, checkout, order completion) happen in server actions, not on the client.

**Existing instrumentation:**

- **Sentry** — already installed with session replay (10% general, 100% on error), performance tracing (20%), browser profiling. We keep Sentry for error tracking but change its replay config.
- **@vercel/speed-insights** — currently installed. We are removing it and replacing with PostHog Web Vitals (Speed Insights costs $10/month, PostHog covers it free within the 1M event pool).

PostHog consolidates product analytics, web analytics, session replay, feature flags, experiments, and web vitals into one SDK on the free tier. See the ADR for the full decision rationale.

---

## 1. Server-Side SDK (posthog-node)

### 1.1 Installation

Install `posthog-node` in the storefront workspace.

### 1.2 Singleton Client — `storefront/lib/posthog-server.ts`

- Lazy-initialized: client is created on first use, not at import time
- No-op when `POSTHOG_API_KEY` is not set (same conditional pattern as Resend in this codebase)
- Shutdown hook via `process.on('beforeExit')` to flush pending events before process exit
- Exports: `getPostHogServer()` returning the singleton instance or `null`

### 1.3 Server-Side Tracking — `storefront/lib/analytics.ts`

Exports `trackServer(event, props)`:

- Accepts event name + properties + optional `distinct_id` override
- Resolves `distinct_id` from: (1) explicit parameter, (2) auth session via `getAuthToken()` → Medusa customer ID, (3) fallback to anonymous ID from `_ph_anon_id` cookie
- No-op when PostHog is not configured (returns immediately, no error)
- Calls `posthog.capture()` on the server singleton

### 1.4 Server-Side Feature Flags — `storefront/lib/feature-flags.ts`

Exports `getFeatureFlag(flag, distinctId)`:

- Returns `Promise<boolean | string>` — evaluates at request time in RSC
- No layout shift, no hydration mismatch (server-evaluated before render)
- Returns a typed default when PostHog is not configured
- Handles both boolean flags and multivariate experiment variants

Exports `getFeatureFlags(distinctId)`:

- Batch-fetches all flags for a user in one call
- Used by the root layout to bootstrap the client provider (see Section 4.2)
- Returns `Record<string, boolean | string>` or empty object when not configured

Exports `trackGoal(event, value?)`:

- Thin wrapper around `trackServer` that tags events as experiment goals
- Used for key conversion events (e.g., `order_completed` with order total as value)

---

## 2. Client-Side SDK (posthog-js)

### 2.1 Installation

Install `posthog-js` in the storefront workspace.

### 2.2 PostHog Provider — `storefront/components/providers/posthog-provider.tsx`

Client component (`'use client'`) that wraps the app in the root layout.

**Initialization config:**

```typescript
posthog.init(NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  autocapture: false,                    // Custom events only — protect 1M quota
  capture_pageview: true,                // Automatic pageviews for web analytics
  capture_pageleave: true,               // Bounce rate tracking
  persistence: 'localStorage+cookie',    // Default persistence
  session_recording: {
    maskAllInputs: true,                 // CRITICAL: mask checkout/payment fields
    maskTextContent: false,              // Allow text content in replays
    networkPayloadCapture: { recordBody: false },  // Capture network requests
    consoleLogRecordingEnabled: true,    // Correlate with Sentry errors
  },
  bootstrap: {
    distinctID: <anonymous_id_or_customer_id>,  // From server (see Section 3)
    featureFlags: <server_evaluated_flags>,     // From server (see Section 4.2)
  },
})
```

**Provider placement in root layout:**

The `PostHogProvider` is added inside `AppProviders` in `app/layout.tsx`. It receives `bootstrapDistinctId` and `bootstrapFlags` as props from the server layout, which resolves them via `retrieveCustomer()` and `getFeatureFlags()`.

### 2.3 Client-Side Tracking

Exports `trackClient(event, props)` from `storefront/lib/analytics.ts`:

- Calls `posthog.capture()` on the client
- No-op when `NEXT_PUBLIC_POSTHOG_KEY` is not set
- Same type safety as `trackServer` — both are generic over the `AnalyticsEvents` type map

### 2.4 Slim Bundle

Use the slim PostHog bundle to minimize impact on Lighthouse:

- Import from `posthog-js/dist/module.slim` (verify this path against the installed `posthog-js` version at install time — the dist path has changed across major versions)
- Explicitly load extensions: recorder (session replay), exception-autocapture, web-vitals
- Do NOT load the surveys extension in this PR (deferred to follow-up)
- Defer script loading to avoid blocking initial render
- Use Context7 MCP to verify the current slim bundle API before implementing

---

## 3. Identity Management

### 3.1 Anonymous ID Strategy

**Problem:** PostHog JS generates its own `distinct_id` in localStorage. If we separately generate a UUID cookie for server-side tracking, we'd have two anonymous IDs = split users.

**Solution:** We own the anonymous ID. It is generated in `proxy.ts` (Next.js 16 middleware), not in RSC render — because `cookies().set()` is not supported during RSC rendering.

1. `storefront/proxy.ts` runs on every request before rendering
2. If `_ph_anon_id` cookie is missing, generate a UUID and set it via `NextResponse` headers
3. Cookie config:
   - `httpOnly: false` (PostHog JS needs to read it)
   - `sameSite: lax`
   - `secure: true` in production
   - `maxAge: 365 days`
4. Server-side: `trackServer()` reads `_ph_anon_id` from `cookies()` (read is allowed in RSC)
5. Client-side: PostHog provider reads the cookie and bootstraps with it: `bootstrap: { distinctID: anonymousId }`
6. Both server and client use the identical `distinct_id` — no split

**Important:** `storefront/lib/posthog-cookies.ts` contains only cookie-reading helpers (server-safe). Cookie _creation_ happens exclusively in `proxy.ts`.

### 3.2 Authenticated Customers

- Use Medusa customer ID (`customer.id`) as `distinct_id`
- Resolved via `retrieveCustomer()` from `lib/medusa/customer.ts`

### 3.3 Identity Merge on Login/Signup

**On login (`customer.ts` → `login()`):**

> **CRITICAL:** `login()` ends with `redirect("/account")` which throws internally and terminates execution. All tracking calls MUST be placed before `revalidateCustomer()` and `redirect()`.

1. Server-side: `posthog.alias({ distinctId: customerId, alias: anonymousId })` — merges anonymous → customer
2. Server-side: `trackServer('customer_logged_in', ...)` with `distinct_id: customerId`
3. Then `revalidateCustomer()` and `redirect()` — tracking is already dispatched
4. Client-side: PostHog provider detects new `bootstrapDistinctId` prop on re-render (customer ID vs previous anonymous ID), calls `posthog.identify(customerId)`

**On signup (`customer.ts` → `signup()`):**

> **CRITICAL:** Same `redirect()` constraint as login. Place all tracking before `redirect()`.

1. Same merge pattern as login — `posthog.alias()` server-side before redirect
2. `trackServer('customer_signed_up', ...)` with `distinct_id: customerId` before redirect

**On logout (`customer.ts` → `signout()`):**

> **CRITICAL:** Same `redirect()` constraint. Place tracking before `redirect("/")`.

1. Server-side: `trackServer('customer_logged_out', ...)` with `distinct_id: customerId` before redirect
2. Client-side: PostHog provider detects `bootstrapDistinctId` prop changed from a customer ID to an anonymous ID. A `useEffect` comparing current vs previous `bootstrapDistinctId` calls `posthog.reset()` when transitioning from authenticated to anonymous.
3. `proxy.ts` generates a new `_ph_anon_id` cookie on the next request (since the old one is still present, we clear it in `signout()` alongside the other `_medusa_*` cookies, and `proxy.ts` regenerates it)

### 3.4 Guest Checkout

Guests keep their anonymous ID throughout checkout. The anonymous ID is the `distinct_id` for all checkout events. If the guest later creates an account, the standard login merge applies.

---

## 4. Feature Flags & Experiments

### 4.1 Server-Side Flag Evaluation

Feature flags are evaluated server-side in RSC for zero-flash rendering:

```typescript
// In any server component or layout
const showNewCheckout = await getFeatureFlag('new-checkout-flow', distinctId)
```

Client-side flag evaluation is acceptable only for interactive UI that doesn't exist in the initial RSC render (e.g., a drawer variant triggered by a button click).

### 4.2 Flag Bootstrapping (Server to Client)

**Flow:**

1. Root layout (`app/layout.tsx`) calls `getFeatureFlags(distinctId)` — batch-fetches all flags
2. Passes the result as a prop to `PostHogProvider`: `<PostHogProvider bootstrapFlags={flags}>`
3. Provider initializes PostHog with `bootstrap: { featureFlags: flags }`
4. Client PostHog SDK uses bootstrapped values immediately — no re-fetch, no flicker

This ensures experiments show the correct variant on first render, both server-side (RSC) and client-side (hydration).

**Performance note:** Calling `getFeatureFlags()` in the root layout makes it dynamic on every request. To minimize latency, use PostHog's local evaluation mode (downloads flag definitions periodically, evaluates locally without network calls). The `posthog-node` client supports this via `personalApiKey` + `featureFlagsPollingInterval`. This keeps flag evaluation at <1ms per request.

### 4.3 Experiments Infrastructure

PostHog experiments are built on top of feature flags — if flags work, experiments work. No additional code needed beyond:

- `getFeatureFlag()` handles both boolean flags and multivariate variants
- `trackGoal(event, value?)` tags events as experiment goals (e.g., `order_completed` with order total)
- No actual experiments to run yet — infrastructure only so experiments can be created in the PostHog dashboard once traffic exists

---

## 5. Session Replay

### 5.1 PostHog Session Replay (Behavior Analytics)

Enabled in the PostHog provider config (see Section 2.2):

- Records all sessions for product/behavior analysis
- `maskAllInputs: true` — **CRITICAL**: checkout and payment fields must never be recorded in plaintext
- `maskTextContent: false` — allow non-input text to be visible in replays
- Network request capture enabled (debug failed API calls during checkout)
- Console log capture enabled (correlate with Sentry error sessions)
- Free tier: 5,000 recordings/month — sufficient for early traffic
- No custom code needed — posthog-js handles recording automatically

### 5.2 Sentry Replay Config Change

**Change** the existing Sentry config:

| Setting | Current | New |
|---------|---------|-----|
| `replaysSessionSampleRate` | `0.1` (10%) | `0` (disabled) |
| `replaysOnErrorSampleRate` | `1.0` (100%) | `1.0` (unchanged) |

PostHog handles behavior replay. Sentry handles error-context replay only.

**Dual-replay on errors:** On error sessions, both PostHog and Sentry replays will be active simultaneously. This is intentional — Sentry's error-correlated replay provides stack-trace-linked debugging context that PostHog doesn't, while PostHog's replay provides the broader behavioral context. The two recorders use independent DOM observers; the resource overhead is negligible since error sessions are a small fraction of total sessions.

**Files to modify:**
- `storefront/instrumentation-client.ts` — update Sentry browser config

---

## 6. Web Analytics & Web Vitals

### 6.1 PostHog Web Analytics

Enabled automatically with `capture_pageview: true` in the provider config. Replaces the need for Google Analytics:

- Automatic: pageviews, bounce rate, session duration, traffic sources, referrers
- Shares the same 1M event pool as product analytics — no extra cost

### 6.2 Remove @vercel/speed-insights

**Actions:**
1. `bun remove @vercel/speed-insights` in the storefront workspace
2. Remove the `<SpeedInsights />` component from the root layout
3. Remove any Speed Insights imports

Vercel Speed Insights costs $10/month per project. PostHog Web Vitals covers the same data within the free tier.

### 6.3 PostHog Web Vitals

Create `storefront/app/web-vitals.tsx` (client component):

- Uses Next.js `useReportWebVitals` hook
- Captures LCP, CLS, INP, FCP, TTFB via `posthog.capture()`
- Samples at ~10% of pageviews using a stable per-session random draw: compute `Math.random() < 0.1` once on component mount (not per metric callback), store in a ref, and use that ref in every `useReportWebVitals` callback. This prevents inconsistent per-render sampling.
- Added to root layout in place of the removed `<SpeedInsights />`

---

## 7. Event Catalog

All events are defined in a single `AnalyticsEvents` type map. Both `trackServer` and `trackClient` are generic over this map — TypeScript enforces correct event names and property types at compile time.

**Naming convention:** `snake_case`, `noun_verbed` (e.g., `product_added_to_cart`).

### 7.1 Server-Side Events

#### Cart & Checkout

| Event | Location | Properties |
|-------|----------|------------|
| `product_added_to_cart` | `components/cart/actions.ts` → `addItem()` | `product_id`, `variant_id`, `quantity`, `price` |
| `cart_item_removed` | `components/cart/actions.ts` → `removeItem()` | `product_id`, `variant_id` |
| `cart_item_updated` | `components/cart/actions.ts` → `updateItemQuantity()` | `product_id`, `variant_id`, `new_quantity` |
| `checkout_started` | `app/checkout/page.tsx` (checkout page RSC) | `cart_id`, `item_count`, `cart_total` |
| `checkout_step_completed` | Server actions: `setCartEmail()` → `email`, `setCartAddresses()` → `address`, `setShippingMethod()` → `shipping`, `initializePaymentSession()` → `payment`, `completeCart()` → `review` | `step_name` (`email` / `address` / `shipping` / `payment` / `review`), `step_number` (1-5) |
| `order_completed` | `lib/medusa/checkout.ts` → `completeCart()` | `order_id`, `order_total`, `item_count`, `currency_code` |

#### Customer Lifecycle

| Event | Location | Properties |
|-------|----------|------------|
| `customer_signed_up` | `lib/medusa/customer.ts` → `signup()` | `method` (`email`) |
| `customer_logged_in` | `lib/medusa/customer.ts` → `login()` | `method` (`email`) |
| `customer_logged_out` | `lib/medusa/customer.ts` → `signout()` | _(none)_ |
| `password_reset_requested` | `lib/medusa/customer.ts` → `requestPasswordReset()` | `email` |
| `password_reset_completed` | `lib/medusa/customer.ts` → `completePasswordReset()` | _(none)_ |

#### Account Management

| Event | Location | Properties |
|-------|----------|------------|
| `profile_updated` | `lib/medusa/customer.ts` → `updateCustomer()` | `fields_changed` (array of field names) |
| `address_added` | `lib/medusa/customer.ts` → `addCustomerAddress()` | `country_code` |
| `address_updated` | `lib/medusa/customer.ts` → `updateCustomerAddress()` | `country_code` |
| `address_deleted` | `lib/medusa/customer.ts` → `deleteCustomerAddress()` | _(none)_ |

#### Auth Errors

| Event | Location | Properties |
|-------|----------|------------|
| `auth_rate_limited` | `lib/medusa/customer.ts` (429 detection) | `action` (`login` / `signup` / `password-reset`) |

#### Wishlist

| Event | Location | Properties |
|-------|----------|------------|
| `wishlist_item_added` | `lib/medusa/wishlist.ts` → `addToWishlist()` | `product_id`, `variant_id`, `wishlist_id` |
| `wishlist_item_removed` | `lib/medusa/wishlist.ts` → `removeFromWishlist()` | `product_id`, `variant_id`, `wishlist_id` |
| `wishlist_shared` | `lib/medusa/wishlist.ts` → `shareWishlist()` | `wishlist_id`, `item_count` |
| `wishlist_created` | `lib/medusa/wishlist.ts` → `createWishlist()` | `wishlist_id`, `name` |
| `wishlist_renamed` | `lib/medusa/wishlist.ts` → `renameWishlist()` | `wishlist_id` |
| `wishlist_deleted` | `lib/medusa/wishlist.ts` → `deleteWishlist()` | `wishlist_id` |
| `wishlist_imported` | `lib/medusa/wishlist.ts` → `importWishlist()` | `source_wishlist_id`, `item_count` |

#### Reviews

| Event | Location | Properties |
|-------|----------|------------|
| `review_submitted` | `lib/medusa/reviews.ts` → `addProductReview()` | `product_id`, `rating`, `has_images` |

#### Search

| Event | Location | Properties |
|-------|----------|------------|
| `search_performed` | `components/search-command/actions.ts` | `query`, `result_count` |

#### Product

| Event | Location | Properties |
|-------|----------|------------|
| `product_viewed` | `app/product/[handle]/page.tsx` (product page RSC) | `product_id`, `product_name`, `price`, `category`, `variant_count`, `has_reviews`, `avg_rating` |

#### Post-Purchase

| Event | Location | Properties |
|-------|----------|------------|
| `invoice_downloaded` | `app/api/orders/[id]/invoice/route.ts` | `order_id` |
| `abandoned_cart_recovered` | `app/cart/recover/[id]/route.ts` | `cart_id`, `item_count` |

### 7.2 Client-Side Events

#### Navigation & Discovery

| Event | Location | Properties |
|-------|----------|------------|
| `cart_drawer_opened` | `components/cart/index.tsx` | _(none)_ |
| `product_quick_view_opened` | `components/product/product-card-with-quick-view.tsx` | `product_id` |
| `search_command_opened` | `components/search-command/index.tsx` | _(none)_ |
| `search_command_closed` | `components/search-command/index.tsx` | _(none)_ |
| `collection_filter_changed` | `components/layout/search/sort-filter-menu.tsx` | `filter_type`, `filter_value` |
| `sort_option_selected` | `components/layout/search/sort-filter-menu.tsx` | `sort_key` |
| `mobile_menu_opened` | `components/layout/navbar/navbar-client.tsx` | _(none)_ |
| `mobile_filters_opened` | `components/layout/search/mobile-filters.tsx` | _(none)_ |

#### Product Engagement

| Event | Location | Properties |
|-------|----------|------------|
| `product_variant_selected` | `components/product/product-detail.tsx` + `product-quick-view.tsx` | `product_id`, `option_name`, `option_value` |
| `product_image_viewed` | `components/product/product-detail.tsx` | `product_id`, `image_index` |
| `product_details_expanded` | `components/product/product-detail.tsx` | `product_id`, `section_name` |

#### Reviews

| Event | Location | Properties |
|-------|----------|------------|
| `review_form_opened` | `components/reviews/ProductReviews.tsx` | `product_id` |

#### Wishlist

| Event | Location | Properties |
|-------|----------|------------|
| `wishlist_tab_switched` | Wishlist page | `wishlist_id` |

#### Checkout Friction (Client-Side)

| Event | Location | Properties |
|-------|----------|------------|
| `checkout_step_edited` | `components/checkout/checkout-review.tsx` | `step_name` |
| `checkout_payment_failed` | `components/checkout/checkout-review.tsx` | `error_code`, `error_message` |
| `checkout_payment_success_order_failed` | `components/checkout/checkout-review.tsx` | `cart_id`, `payment_intent_id` |
| `checkout_shipping_no_options` | `components/checkout/checkout-shipping.tsx` | `country_code`, `postal_code` |

> Note: Payment errors are client-side events because Stripe confirmation (`stripe.confirmPayment()` / `stripe.confirmCardPayment()`) happens in the browser. The server never sees card declines.

---

## 8. Shared Type Abstraction

**`storefront/lib/analytics.ts`** — shared types + client tracking (safe to import anywhere):

```typescript
// Shared type map — imported by both analytics.ts and analytics-server.ts
type AnalyticsEvents = {
  product_added_to_cart: { product_id: string; variant_id: string; quantity: number; price: number }
  customer_signed_up: { method: string }
  checkout_payment_failed: { error_code: string; error_message: string }
  // ... all events from Section 7
}

// Client-side tracking — calls posthog.capture() in the browser
function trackClient<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E]
): void
```

**`storefront/lib/analytics-server.ts`** — server-only tracking (imports `server-only`, reads cookies via `next/headers`):

```typescript
// Server-side tracking — calls posthog.capture() on the Node singleton
// Resolves distinct_id from auth session or _ph_anon_id cookie
function trackServer<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
  distinctId?: string
): void
```

Both functions provide autocomplete and compile-time property checking. Adding a new event requires adding it to the `AnalyticsEvents` type map in `analytics.ts` first. The file split prevents client bundles from importing `server-only` modules.

---

## 9. Environment Variables

| Variable | Side | Purpose | Required |
|----------|------|---------|----------|
| `POSTHOG_API_KEY` | Server | Server-side PostHog client | No — no-op when absent |
| `POSTHOG_PERSONAL_API_KEY` | Server | Local flag evaluation (avoids network calls per request) | No — falls back to network evaluation without it |
| `NEXT_PUBLIC_POSTHOG_KEY` | Client | Client-side PostHog SDK | No — no-op when absent |
| `NEXT_PUBLIC_POSTHOG_HOST` | Client | PostHog API host | No — defaults to `https://us.i.posthog.com` |

All three are optional. The app runs cleanly without PostHog configured — all tracking is no-op.

Add to `storefront/.env.example` with documentation comments.

---

## 10. Surveys (Follow-Up PR)

Deferred to a separate PR after the core integration is stable.

**Planned survey types:**
- Post-purchase NPS (trigger after order confirmation page)
- Cart abandonment exit survey (trigger on cart page if user navigates away)
- Product feedback ("How did you hear about us?" on account creation)

**Why deferred:** Surveys require the posthog-js surveys extension bundle, which would increase the initial slim bundle. Add it in the follow-up PR when ready to use surveys.

---

## 11. Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `storefront/lib/posthog-server.ts` | Singleton PostHog Node client |
| `storefront/lib/analytics.ts` | `trackClient()`, `AnalyticsEvents` type map (shared types) |
| `storefront/lib/analytics-server.ts` | `trackServer()` — server-only, reads cookies via `next/headers` |
| `storefront/lib/feature-flags.ts` | `getFeatureFlag()`, `getFeatureFlags()`, `trackGoal()` |
| `storefront/components/providers/posthog-provider.tsx` | Client-side PostHog provider component |
| `storefront/app/web-vitals.tsx` | Web Vitals capture via `useReportWebVitals` |
| `storefront/lib/posthog-cookies.ts` | Anonymous ID cookie reading helpers (server-safe) |

### Modified Files

| File | Change |
|------|--------|
| `storefront/proxy.ts` | **New file.** Generate `_ph_anon_id` cookie on first visit (runs before every request) |
| `storefront/app/layout.tsx` | Add PostHogProvider + WebVitals, remove SpeedInsights |
| `storefront/components/cart/actions.ts` | Add `trackServer()` calls for cart events |
| `storefront/lib/medusa/checkout.ts` | Add `trackServer()` calls for checkout events |
| `storefront/lib/medusa/customer.ts` | Add `trackServer()` calls for auth/account events + identity merge. Clear `_ph_anon_id` cookie in `signout()`. **All tracking calls MUST go before `redirect()`.** |
| `storefront/lib/medusa/wishlist.ts` | Add `trackServer()` calls for wishlist events |
| `storefront/lib/medusa/reviews.ts` | Add `trackServer()` calls for review events |
| `storefront/components/search-command/actions.ts` | Add `trackServer()` for search events |
| `storefront/app/checkout/page.tsx` | Add `trackServer('checkout_started')` |
| `storefront/app/product/[handle]/page.tsx` | Add `trackServer('product_viewed')` |
| `storefront/app/api/orders/[id]/invoice/route.ts` | Add `trackServer('invoice_downloaded')` |
| `storefront/app/cart/recover/[id]/route.ts` | Add `trackServer('abandoned_cart_recovered')` |
| `storefront/components/cart/index.tsx` | Add `trackClient()` for cart drawer opened |
| `storefront/components/product/product-card-with-quick-view.tsx` | Add `trackClient()` for quick view |
| `storefront/components/product/product-detail.tsx` | Add `trackClient()` for variant/image/details events |
| `storefront/components/search-command/index.tsx` | Add `trackClient()` for search open/close |
| `storefront/components/layout/search/sort-filter-menu.tsx` | Add `trackClient()` for filter/sort events |
| `storefront/components/layout/search/mobile-filters.tsx` | Add `trackClient()` for mobile filters |
| `storefront/components/layout/navbar/navbar-client.tsx` | Add `trackClient()` for mobile menu |
| `storefront/components/reviews/ProductReviews.tsx` | Add `trackClient()` for review form opened |
| `storefront/components/checkout/checkout-review.tsx` | Add `trackClient()` for payment errors + step edited |
| `storefront/components/checkout/checkout-shipping.tsx` | Add `trackClient()` for shipping no-options |
| `storefront/instrumentation-client.ts` | Change Sentry `replaysSessionSampleRate` from 0.1 to 0 |
| `storefront/.env.example` | Add PostHog env vars |
| `storefront/package.json` | Add posthog-node, posthog-js; remove @vercel/speed-insights |

---

## 12. Commit Strategy

One commit per logical unit:

1. **Server client + shared abstraction** — `posthog-server.ts`, `analytics.ts` (type map + trackClient), `analytics-server.ts` (trackServer), `posthog-cookies.ts`
2. **Identity management** — `proxy.ts` (anonymous ID cookie generation), identity merge in login/signup/logout, PostHog provider with bootstrap
3. **Server event instrumentation** — all `trackServer()` calls in cart, checkout, customer, wishlist, reviews, search, product, post-purchase
4. **Client provider + session replay + client events** — PostHog provider in layout, all `trackClient()` calls
5. **Web vitals + remove Speed Insights** — `web-vitals.tsx`, uninstall `@vercel/speed-insights`, remove component
6. **Sentry replay config change** — `replaysSessionSampleRate` 0.1 to 0
7. **Feature flags + experiments infrastructure** — `feature-flags.ts`, flag bootstrapping in layout, `trackGoal()`

---

## 13. Acceptance Criteria

- [ ] `bun run build` passes with no type errors
- [ ] All server-side events from the catalog fire with correct `distinct_id` and typed properties
- [ ] All client-side events from the catalog fire with correct `distinct_id`
- [ ] Checkout error events fire on failure paths: `checkout_payment_failed`, `checkout_payment_success_order_failed`, `checkout_shipping_no_options`, `auth_rate_limited`
- [ ] No split users — anonymous browsing -> login correctly merges into one person in PostHog
- [ ] Logout calls `posthog.reset()` and starts a new anonymous session
- [ ] Feature flags evaluated server-side: page renders correct variant with no flash
- [ ] Feature flags bootstrapped to client: no re-fetch flicker on hydration
- [ ] PostHog session replay records behavior with masked form inputs
- [ ] Sentry replay config changed: general sampling = 0, on-error sampling = 1.0
- [ ] Web analytics dashboard shows pageviews, bounce rate, traffic sources without GA4
- [ ] Web vitals (LCP, CLS, INP, FCP, TTFB) visible in PostHog with ~10% sampling
- [ ] `@vercel/speed-insights` fully removed — package uninstalled, component removed from layout
- [ ] Experiment infrastructure works: can create an experiment in PostHog dashboard, variant is evaluated server-side, goal events are tracked
- [ ] Zero impact on Lighthouse performance (slim bundle + deferred script load)
- [ ] No tracking when env vars are missing — app runs cleanly without PostHog configured
- [ ] Feature flag helper returns typed default when PostHog is not configured
- [ ] Surveys are NOT included in this PR — noted as follow-up
- [ ] `product_viewed` fires on product page load with structured product data
- [ ] New events documented in PR description per CLAUDE.md analytics convention

---

## 14. Out of Scope

- Express checkout events (`express_checkout_started`, `express_checkout_completed`, `express_checkout_failed`) — tracked in TODO.md, will be added when express checkout is implemented
- PostHog surveys extension — follow-up PR
- PostHog autocapture — explicitly disabled to protect event quota
- Google Analytics — not needed; PostHog web analytics covers the same data
- Backend (Medusa) analytics — this spec covers storefront only
