# PostHog Analytics Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PostHog analytics (server + client), feature flags, session replay, web vitals, and experiments infrastructure to the CrowCommerce storefront.

**Architecture:** PostHog Node singleton for server-side tracking in Server Actions/RSC. PostHog JS slim bundle for client-side tracking in client components. Identity managed via `_ph_anon_id` cookie generated in `proxy.ts`, bootstrapped into the client provider. Feature flags evaluated server-side for zero-flash, bootstrapped to client.

**Tech Stack:** posthog-node, posthog-js, Next.js 16 proxy.ts, TypeScript generics for type-safe event catalog

**Spec:** [docs/superpowers/specs/2026-03-20-posthog-integration-design.md](../specs/2026-03-20-posthog-integration-design.md)

---

## Pre-Implementation

- [ ] **Step 1: Pull latest posthog-node and posthog-js docs via Context7 MCP**

Before writing any code, use the Context7 MCP server to fetch current documentation for both `posthog-node` and `posthog-js`. Specifically verify:
- The slim bundle import path (`posthog-js/dist/module.slim` or whatever the current equivalent is)
- The `posthog.init()` config options (especially `session_recording`, `bootstrap`, `autocapture`)
- The `posthog-node` `PostHog` constructor options (especially `personalApiKey`, `featureFlagsPollingInterval`)
- The `posthog.alias()` and `posthog.identify()` server-side API

Save any findings that differ from the spec as notes for adjustments during implementation.

- [ ] **Step 2: Install dependencies**

Run from the monorepo root:

```bash
cd storefront && bun add posthog-node posthog-js
```

Verify both appear in `storefront/package.json` dependencies.

---

## Task 1: Server Client + Shared Type Abstraction

**Files:**
- Create: `storefront/lib/analytics.ts` — `AnalyticsEvents` type map + `trackClient()`
- Create: `storefront/lib/analytics-server.ts` — `trackServer()` (server-only)
- Create: `storefront/lib/posthog-server.ts` — singleton PostHog Node client
- Create: `storefront/lib/posthog-cookies.ts` — `_ph_anon_id` cookie reader (server-only)
- Modify: `storefront/.env.example` — add PostHog env vars

### Steps

- [ ] **Step 1: Create `storefront/lib/posthog-server.ts`**

Lazy-initialized singleton. No-op when `POSTHOG_API_KEY` is absent. Follows the same conditional pattern as Resend in this codebase.

```typescript
import "server-only"
import { PostHog } from "posthog-node"

let client: PostHog | null = null

export function getPostHogServer(): PostHog | null {
  const apiKey = process.env.POSTHOG_API_KEY
  if (!apiKey) return null

  if (!client) {
    client = new PostHog(apiKey, {
      host: "https://us.i.posthog.com",
      // If POSTHOG_PERSONAL_API_KEY is set, use local evaluation (no network per request)
      personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
      featureFlagsPollingInterval: 30000, // 30 seconds
    })

    process.on("beforeExit", () => {
      client?.shutdown()
    })
  }

  return client
}
```

> **Adjust constructor options based on Context7 docs findings from Pre-Implementation Step 1.**

- [ ] **Step 2: Create `storefront/lib/posthog-cookies.ts`**

Server-only cookie helpers for the `_ph_anon_id` cookie. Cookie *creation* happens in proxy/middleware (Task 2). This file provides read + remove helpers. The remove function is used in `signout()` to clear the anonymous ID.

```typescript
import "server-only"
import { cookies as nextCookies } from "next/headers"

const PH_ANON_COOKIE = "_ph_anon_id"

export async function getPostHogAnonId(): Promise<string | undefined> {
  const cookies = await nextCookies()
  return cookies.get(PH_ANON_COOKIE)?.value
}

export async function removePostHogAnonId(): Promise<void> {
  const cookies = await nextCookies()
  cookies.set(PH_ANON_COOKIE, "", { maxAge: -1 })
}
```

- [ ] **Step 3: Create `storefront/lib/analytics.ts`**

Shared types + client-side tracking. This file is safe to import from both server and client components.

Define the complete `AnalyticsEvents` type map with all events from Section 7 of the spec. Export `trackClient()` which calls `posthog.capture()` in the browser.

```typescript
import type posthog from "posthog-js"

// ============================================================
// Event Catalog — all events must be defined here before use
// ============================================================

export type AnalyticsEvents = {
  // Cart & Checkout (server)
  product_added_to_cart: { product_id: string; variant_id: string; quantity: number; price: number }
  cart_item_removed: { product_id: string; variant_id: string }
  cart_item_updated: { product_id: string; variant_id: string; new_quantity: number }
  checkout_started: { cart_id: string; item_count: number; cart_total: number }
  checkout_step_completed: { step_name: "email" | "address" | "shipping" | "payment" | "review"; step_number: number }
  order_completed: { order_id: string; order_total: number; item_count: number; currency_code: string }

  // Customer Lifecycle (server)
  customer_signed_up: { method: string }
  customer_logged_in: { method: string }
  customer_logged_out: Record<string, never>
  password_reset_requested: { email: string }
  password_reset_completed: Record<string, never>

  // Account Management (server)
  profile_updated: { fields_changed: string[] }
  address_added: { country_code: string }
  address_updated: { country_code: string }
  address_deleted: Record<string, never>

  // Auth Errors (server)
  auth_rate_limited: { action: "login" | "signup" | "password-reset" }

  // Wishlist (server)
  wishlist_item_added: { product_id: string; variant_id: string; wishlist_id: string }
  wishlist_item_removed: { product_id: string; variant_id: string; wishlist_id: string }
  wishlist_shared: { wishlist_id: string; item_count: number }
  wishlist_created: { wishlist_id: string; name: string }
  wishlist_renamed: { wishlist_id: string }
  wishlist_deleted: { wishlist_id: string }
  wishlist_imported: { source_wishlist_id: string; item_count: number }

  // Reviews (server)
  review_submitted: { product_id: string; rating: number; has_images: boolean }

  // Search (server)
  search_performed: { query: string; result_count: number }

  // Product (server)
  product_viewed: {
    product_id: string; product_name: string; price: number
    category: string; variant_count: number; has_reviews: boolean; avg_rating: number
  }

  // Post-Purchase (server)
  invoice_downloaded: { order_id: string }
  abandoned_cart_recovered: { cart_id: string; item_count: number }

  // Navigation & Discovery (client)
  cart_drawer_opened: Record<string, never>
  product_quick_view_opened: { product_id: string }
  search_command_opened: Record<string, never>
  search_command_closed: Record<string, never>
  collection_filter_changed: { filter_type: string; filter_value: string }
  sort_option_selected: { sort_key: string }
  mobile_menu_opened: Record<string, never>
  mobile_filters_opened: Record<string, never>

  // Product Engagement (client)
  product_variant_selected: { product_id: string; option_name: string; option_value: string }
  product_image_viewed: { product_id: string; image_index: number }
  product_details_expanded: { product_id: string; section_name: string }

  // Reviews (client)
  review_form_opened: { product_id: string }

  // Wishlist (client)
  wishlist_tab_switched: { wishlist_id: string }

  // Checkout Friction (client)
  checkout_step_edited: { step_name: string }
  checkout_payment_failed: { error_code: string; error_message: string }
  checkout_payment_success_order_failed: { cart_id: string; payment_intent_id: string }
  checkout_shipping_no_options: { country_code: string; postal_code: string }
}

// ============================================================
// Client-side tracking
// ============================================================

let posthogInstance: typeof posthog | null = null

export function setPostHogClient(instance: typeof posthog): void {
  posthogInstance = instance
}

export function trackClient<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
): void {
  if (!posthogInstance) return
  posthogInstance.capture(event, properties as Record<string, unknown>)
}
```

- [ ] **Step 4: Create `storefront/lib/analytics-server.ts`**

Server-only tracking. Imports `server-only` to prevent client bundles from including it. Resolves `distinct_id` from auth session or anonymous cookie.

```typescript
import "server-only"
import type { AnalyticsEvents } from "./analytics"
import { getPostHogServer } from "./posthog-server"
import { getPostHogAnonId } from "./posthog-cookies"
import { getAuthToken } from "lib/medusa/cookies"

async function resolveDistinctId(): Promise<string | undefined> {
  // Prefer authenticated customer ID (JWT decode not needed —
  // we use the token presence as indicator, actual customer ID
  // is passed explicitly in auth events)
  const token = await getAuthToken()
  if (token) return undefined // Let caller pass explicit ID

  return await getPostHogAnonId()
}

export async function trackServer<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
  distinctId?: string,
): Promise<void> {
  const posthog = getPostHogServer()
  if (!posthog) return

  const id = distinctId || (await resolveDistinctId())
  if (!id) return

  posthog.capture({
    distinctId: id,
    event,
    properties: properties as Record<string, unknown>,
  })
}
```

- [ ] **Step 5: Add PostHog env vars to `storefront/.env.example`**

Append after the Sentry section:

```
# --- PostHog ------------------------------------------------------------------
# PostHog — Product analytics, web analytics, session replay, feature flags
# Create a project at posthog.com, copy the Project API Key
# POSTHOG_API_KEY is server-only; NEXT_PUBLIC_ vars are exposed to the browser
POSTHOG_API_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
# Optional. Defaults to https://us.i.posthog.com (US region)
# NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
# Optional. Personal API key for local feature flag evaluation (avoids network calls)
# Generate at: https://app.posthog.com/settings/user-api-keys
# POSTHOG_PERSONAL_API_KEY=
```

- [ ] **Step 6: Verify build**

```bash
cd storefront && bun run build
```

Expected: build passes with no type errors. No PostHog env vars set = no-op behavior.

- [ ] **Step 7: Commit**

```bash
git add storefront/lib/posthog-server.ts storefront/lib/posthog-cookies.ts storefront/lib/analytics.ts storefront/lib/analytics-server.ts storefront/.env.example storefront/package.json storefront/bun.lock
git commit -m "feat(storefront): add PostHog server client and analytics type abstraction

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Identity Management

**Files:**
- Create: `storefront/proxy.ts` (or `storefront/middleware.ts` — see Step 1 note) — anonymous ID cookie generation
- Modify: `storefront/lib/medusa/customer.ts` — identity merge on login/signup/logout
- Modify: `storefront/lib/medusa/cookies.ts` — (no changes needed, `posthog-cookies.ts` handles PH cookie separately)

### Steps

- [ ] **Step 1: Create the middleware file for anonymous ID cookie generation**

> **FILENAME DECISION:** Check Context7 docs for Next.js 16 to determine if `proxy.ts` is a recognized convention replacing `middleware.ts`. If `proxy.ts` is NOT recognized, name the file `middleware.ts` instead. The code content is identical either way. The spec uses `proxy.ts` based on Next.js 16 naming, but the standard `middleware.ts` API is the fallback.

Place at the same level as `app/` directory. Generates a `_ph_anon_id` cookie on first visit.

```typescript
import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "node:crypto"

const PH_ANON_COOKIE = "_ph_anon_id"

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next()

  if (!request.cookies.get(PH_ANON_COOKIE)) {
    response.cookies.set(PH_ANON_COOKIE, randomUUID(), {
      httpOnly: false, // PostHog JS needs to read this
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  }

  return response
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
```

- [ ] **Step 2: Add identity merge to `login()` in `storefront/lib/medusa/customer.ts`**

Insert tracking calls BEFORE `revalidateCustomer()` and `redirect()` — these throw internally and terminate execution.

After the try/catch blocks for `transferCart()` and `transferWishlist()`, and before `revalidateCustomer()`:

```typescript
// --- PostHog identity merge ---
import { getPostHogServer } from "lib/posthog-server"
import { getPostHogAnonId, removePostHogAnonId } from "lib/posthog-cookies"
import { trackServer } from "lib/analytics-server"
import { retrieveCustomer } from "./customer" // self-import for customer ID
```

In `login()`, insert the tracking block between the final `try { await transferWishlist() }` block (line ~89-93) and the existing `revalidateCustomer()` call (line ~95). Do NOT add new `revalidateCustomer()` or `redirect()` calls — they already exist.

```typescript
  // === INSERT THIS BLOCK between transferWishlist try/catch and revalidateCustomer() ===
  // PostHog: merge anonymous → customer identity
  const customer = await retrieveCustomer()
  if (customer) {
    const anonId = await getPostHogAnonId()
    const posthog = getPostHogServer()
    if (posthog && anonId) {
      posthog.alias({ distinctId: customer.id, alias: anonId })
    }
    await trackServer("customer_logged_in", { method: "email" }, customer.id)
  }
  // === END INSERT — the existing revalidateCustomer() and redirect() follow ===
```

- [ ] **Step 3: Add identity merge to `signup()` in `storefront/lib/medusa/customer.ts`**

Same pattern as login. Insert between the final `try { await transferWishlist() }` block (line ~178-182) and the existing `revalidateCustomer()` call (line ~184). Do NOT add new `revalidateCustomer()` or `redirect()` — they already exist.

```typescript
  // === INSERT THIS BLOCK between transferWishlist try/catch and revalidateCustomer() ===
  const customer = await retrieveCustomer()
  if (customer) {
    const anonId = await getPostHogAnonId()
    const posthog = getPostHogServer()
    if (posthog && anonId) {
      posthog.alias({ distinctId: customer.id, alias: anonId })
    }
    await trackServer("customer_signed_up", { method: "email" }, customer.id)
  }
  // === END INSERT — the existing revalidateCustomer() and redirect() follow ===
```

- [ ] **Step 4: Add tracking + cookie clear to `signout()` in `storefront/lib/medusa/customer.ts`**

Before the existing `removeAuthToken()` call, add tracking. After clearing Medusa cookies, also clear the PostHog anonymous ID so `proxy.ts` regenerates a fresh one:

```typescript
export async function signout(): Promise<void> {
  // Track logout BEFORE clearing cookies (need customer context)
  const customer = await retrieveCustomer()
  if (customer) {
    await trackServer("customer_logged_out", {}, customer.id)
  }

  try {
    await sdk.auth.logout()
  } catch {
    // Logout endpoint may fail if token already expired — proceed anyway
  }

  await removeAuthToken()
  await removeCartId()
  await removeWishlistId()
  await removePostHogAnonId() // Force new anonymous ID on next request

  revalidateTag(TAGS.customers, "max")
  revalidateTag(TAGS.cart, "max")
  revalidateTag(TAGS.wishlists, "max")
  revalidatePath("/", "layout")

  redirect("/")
}
```

- [ ] **Step 5: Verify build**

```bash
cd storefront && bun run build
```

Expected: build passes. proxy.ts is picked up by Next.js 16.

- [ ] **Step 6: Commit**

```bash
git add storefront/proxy.ts storefront/lib/medusa/customer.ts
git commit -m "feat(storefront): add PostHog identity management with proxy.ts

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Server Event Instrumentation

**Files:**
- Modify: `storefront/components/cart/actions.ts` — cart events
- Modify: `storefront/lib/medusa/checkout.ts` — checkout step events + order_completed
- Modify: `storefront/lib/medusa/customer.ts` — account management + password reset + rate limit events
- Modify: `storefront/lib/medusa/wishlist.ts` — wishlist events
- Modify: `storefront/lib/medusa/reviews.ts` — review_submitted
- Modify: `storefront/components/search-command/actions.ts` — search_performed
- Modify: `storefront/app/product/[handle]/page.tsx` — product_viewed
- Modify: `storefront/app/checkout/page.tsx` — checkout_started
- Modify: `storefront/app/api/orders/[id]/invoice/route.ts` — invoice_downloaded
- Modify: `storefront/app/cart/recover/[id]/route.ts` — abandoned_cart_recovered

### Steps

- [ ] **Step 1: Add tracking to `storefront/components/cart/actions.ts`**

Add `import { trackServer } from "lib/analytics-server"` at the top.

In `addItem()` — after the successful `addToCart()` call (inside `try`, before `return null`). Use data already in scope to avoid a second `getCart()` round-trip (which may return stale cached data):

```typescript
    await addToCart([{ merchandiseId: selectedVariantId, quantity: 1 }])
    // Track with data already in scope — avoid extra getCart() call
    // product_id is not available without fetching; pass variant_id as the key identifier
    await trackServer("product_added_to_cart", {
      product_id: "", // Will be enriched by PostHog via product catalog if needed
      variant_id: selectedVariantId,
      quantity: 1,
      price: 0, // Price not available without cart fetch
    })
    return null
```

> **NOTE:** `product_id` and `price` are not available in `addItem()` without a second network call. The implementing engineer should decide: (a) accept empty/zero values and rely on PostHog person properties for enrichment, or (b) accept the extra `getCart()` call latency. Option (a) is recommended for now — these values can be enriched later via PostHog's property definitions or by passing `product_id` through the action parameter from the component.

In `removeItem()` — before the `removeFromCart()` call, capture product info:

```typescript
    const cart = await getCart()
    const removedItem = cart?.lines.find((line) => line.id === lineItemId)
    await removeFromCart([lineItemId])
    if (removedItem) {
      await trackServer("cart_item_removed", {
        product_id: removedItem.merchandise.product?.id || "",
        variant_id: removedItem.merchandise.id,
      })
    }
```

In `updateItemQuantity()` — after the quantity update succeeds (inside the `if (lineItem && lineItem.id)` block, after the update/remove call):

```typescript
      await trackServer("cart_item_updated", {
        product_id: lineItem.merchandise.product?.id || "",
        variant_id: merchandiseId,
        new_quantity: quantity,
      })
```

> **NOTE:** Read `storefront/lib/medusa/index.ts` to verify the `Cart` type structure — the `lines[].merchandise` shape may differ from this pseudocode. Adjust property paths to match the actual transformed cart type.

- [ ] **Step 2: Add tracking to `storefront/lib/medusa/checkout.ts`**

Add `import { trackServer } from "lib/analytics-server"` at the top.

In `setCartEmail()` — after the successful SDK call, before `revalidateCheckout()` in the `finally` block. Since `finally` runs regardless, add inside `try` after the SDK call:

```typescript
    await sdk.store.cart.update(cartId, { email: normalizedEmail }, {}, headers).catch(medusaError)
    await trackServer("checkout_step_completed", { step_name: "email", step_number: 1 })
```

In `setCartAddresses()` — after the successful SDK call:

```typescript
    await sdk.store.cart.update(cartId, { shipping_address: shipping, billing_address: billingAddress }, {}, headers).catch(medusaError)
    await trackServer("checkout_step_completed", { step_name: "address", step_number: 2 })
```

In `setShippingMethod()` — after the successful SDK call:

```typescript
    await sdk.store.cart.addShippingMethod(cartId, { option_id: optionId }, {}, headers).catch(medusaError)
    await trackServer("checkout_step_completed", { step_name: "shipping", step_number: 3 })
```

In `initializePaymentSession()` — after the successful SDK call:

```typescript
    await sdk.store.payment.initiatePaymentSession(cart, { provider_id: providerId, data }, {}, headers).catch(medusaError)
    await trackServer("checkout_step_completed", { step_name: "payment", step_number: 4 })
```

In `completeCart()` — when the result is an order:

```typescript
    if (result.type === "order") {
      await removeCartId()
      await trackServer("checkout_step_completed", { step_name: "review", step_number: 5 })
      await trackServer("order_completed", {
        order_id: result.order.id,
        order_total: result.order.total || 0,
        item_count: result.order.items?.length || 0,
        currency_code: result.order.currency_code || "usd",
      })
      return { type: "order", order: result.order }
    }
```

- [ ] **Step 3: Add tracking to customer management actions in `storefront/lib/medusa/customer.ts`**

The imports were already added in Task 2. Add tracking to:

`requestPasswordReset()` — after the SDK call but before the generic `return { success: true }`:

```typescript
    await sdk.auth.resetPassword("customer", "emailpass", { identifier: normalizedEmail })
    await trackServer("password_reset_requested", { email: normalizedEmail })
```

`completePasswordReset()` — after the successful SDK call:

```typescript
    await sdk.auth.updateProvider("customer", "emailpass", { email: normalizedEmail, password }, token)
    await trackServer("password_reset_completed", {})
```

`updateCustomer()` — after the successful SDK call:

```typescript
    await sdk.store.customer.update(body, {}, headers)
    const fieldsChanged = Object.keys(body).filter((k) => body[k as keyof typeof body] !== undefined)
    await trackServer("profile_updated", { fields_changed: fieldsChanged })
```

`addCustomerAddress()` — after the successful SDK call:

```typescript
    const address = parseAddressFields(formData)
    await sdk.store.customer.createAddress(address, {}, headers)
    await trackServer("address_added", { country_code: address.country_code })
```

`updateCustomerAddress()` — after the successful SDK call:

```typescript
    const address = parseAddressFields(formData)
    await sdk.store.customer.updateAddress(addressId, address, {}, headers)
    await trackServer("address_updated", { country_code: address.country_code })
```

`deleteCustomerAddress()` — after the successful SDK call:

```typescript
    await sdk.store.customer.deleteAddress(addressId, headers)
    await trackServer("address_deleted", {})
```

Rate limit detection — in `login()`, `signup()`, `requestPasswordReset()`, `completePasswordReset()` catch blocks where `isRateLimited(e)` is true:

```typescript
    if (isRateLimited(e)) {
      await trackServer("auth_rate_limited", { action: "login" }) // or "signup", "password-reset"
      return "Too many login attempts. Please try again in 15 minutes."
    }
```

- [ ] **Step 4: Add tracking to `storefront/lib/medusa/wishlist.ts`**

Read the file first to understand the function signatures. Add `import { trackServer } from "lib/analytics-server"` and add `trackServer()` calls after each successful operation. Use the event names and properties from the spec Section 7.1.

- [ ] **Step 5: Add tracking to `storefront/lib/medusa/reviews.ts`**

Read the file first. Add `trackServer("review_submitted", { product_id, rating, has_images })` after a successful review creation.

- [ ] **Step 6: Add tracking to `storefront/components/search-command/actions.ts`**

Read the file first. Add `trackServer("search_performed", { query, result_count })` after the search returns results.

- [ ] **Step 7: Add `product_viewed` to `storefront/app/product/[handle]/page.tsx`**

This is an RSC page. Add `trackServer("product_viewed", { ... })` after fetching the product data but before rendering. Extract the relevant product properties. Use a `try/catch` to ensure tracking errors don't break the product page.

- [ ] **Step 8: Add `checkout_started` to `storefront/app/checkout/page.tsx`**

This is the checkout page RSC. Add `trackServer("checkout_started", { cart_id, item_count, cart_total })` using data from the cart fetch. Wrap in try/catch.

- [ ] **Step 9: Add `invoice_downloaded` to `storefront/app/api/orders/[id]/invoice/route.ts`**

Read the file first. Add `trackServer("invoice_downloaded", { order_id })` after the successful invoice generation/retrieval.

- [ ] **Step 10: Add `abandoned_cart_recovered` to `storefront/app/cart/recover/[id]/route.ts`**

Read the file first. The route already fetches the full cart (with items) before calling `setCartId()`. Use `cart.items?.length ?? 0` for `item_count` — no additional fetch needed. Add `trackServer("abandoned_cart_recovered", { cart_id: id, item_count: cart.items?.length ?? 0 })` after the cart is verified and the cookie is set.

- [ ] **Step 11: Verify build**

```bash
cd storefront && bun run build
```

Expected: no type errors. The `AnalyticsEvents` type map enforces correct event names and property types at compile time.

- [ ] **Step 12: Commit**

```bash
git add storefront/components/cart/actions.ts storefront/lib/medusa/checkout.ts storefront/lib/medusa/customer.ts storefront/lib/medusa/wishlist.ts storefront/lib/medusa/reviews.ts storefront/components/search-command/actions.ts storefront/app/product/ storefront/app/checkout/page.tsx storefront/app/api/orders/ storefront/app/cart/recover/
git commit -m "feat(storefront): instrument server-side PostHog analytics events

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Client Provider + Session Replay + Client Events

**Files:**
- Create: `storefront/components/providers/posthog-provider.tsx` — PostHog client provider
- Modify: `storefront/app/layout.tsx` — add PostHogProvider to AppProviders
- Modify: `storefront/components/cart/index.tsx` — cart_drawer_opened
- Modify: `storefront/components/product/product-card-with-quick-view.tsx` — product_quick_view_opened
- Modify: `storefront/components/product/product-detail.tsx` — variant/image/details events
- Modify: `storefront/components/search-command/index.tsx` — search open/close
- Modify: `storefront/components/layout/search/sort-filter-menu.tsx` — filter/sort events
- Modify: `storefront/components/layout/search/mobile-filters.tsx` — mobile_filters_opened
- Modify: `storefront/components/layout/navbar/navbar-client.tsx` — mobile_menu_opened
- Modify: `storefront/components/reviews/ProductReviews.tsx` — review_form_opened
- Modify: `storefront/components/checkout/checkout-review.tsx` — payment errors + step edited
- Modify: `storefront/components/checkout/checkout-shipping.tsx` — shipping_no_options

### Steps

- [ ] **Step 1: Create `storefront/components/providers/posthog-provider.tsx`**

Client component that initializes PostHog JS with the slim bundle, bootstraps identity, bootstraps feature flags, enables session replay, and handles identity transitions (login → identify, logout → reset).

```typescript
"use client"

import { useEffect, useRef } from "react"
import posthog from "posthog-js" // Adjust to slim bundle path per Context7 findings
import { setPostHogClient } from "lib/analytics"

type PostHogProviderProps = {
  children: React.ReactNode
  bootstrapDistinctId: string | null
  bootstrapFlags?: Record<string, boolean | string>
}

export function PostHogProvider({
  children,
  bootstrapDistinctId,
  bootstrapFlags,
}: PostHogProviderProps) {
  const prevDistinctId = useRef<string | null>(null)

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return

    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: true,
        persistence: "localStorage+cookie",
        session_recording: {
          maskAllInputs: true,
          maskTextContent: false,
          networkPayloadCapture: { recordBody: false },
          consoleLogRecordingEnabled: true, // Correlate with Sentry errors
        },
        bootstrap: {
          distinctID: bootstrapDistinctId || undefined,
          featureFlags: bootstrapFlags || undefined,
        },
      })

      setPostHogClient(posthog)
    }

    prevDistinctId.current = bootstrapDistinctId
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle identity transitions (login/logout)
  useEffect(() => {
    if (!posthog.__loaded) return
    if (prevDistinctId.current === bootstrapDistinctId) return

    // Medusa customer IDs start with "cus_"; anonymous UUIDs do not
    const wasAuthenticated = prevDistinctId.current?.startsWith("cus_")
    const isAuthenticated = bootstrapDistinctId?.startsWith("cus_")

    if (isAuthenticated && !wasAuthenticated) {
      // Login: identify with customer ID
      posthog.identify(bootstrapDistinctId)
    } else if (!isAuthenticated && wasAuthenticated) {
      // Logout: reset to new anonymous state
      posthog.reset()
    }

    prevDistinctId.current = bootstrapDistinctId
  }, [bootstrapDistinctId])

  return <>{children}</>
}
```

> **IMPORTANT — Slim bundle sub-steps:**
> 1. Check Context7 docs for the current slim bundle import path. Replace `import posthog from "posthog-js"` with the slim path (e.g., `import posthog from "posthog-js/dist/module.slim"`)
> 2. After `posthog.init()`, explicitly load required extensions: recorder (session replay), exception-autocapture, web-vitals. The extension loading API varies by version — verify via Context7.
> 3. Do NOT load the surveys extension (deferred to follow-up PR)
> 4. Verify `posthog.__loaded` is still the correct check for initialization status
> 5. Verify the `session_recording` config option names haven't changed

> **Identity detection:** Medusa customer IDs start with `cus_` (e.g., `cus_01JFKXY...`). Anonymous IDs are `randomUUID()` strings. The code uses `startsWith("cus_")` to distinguish them. Verify this prefix against the actual database if unsure.

- [ ] **Step 2: Modify `storefront/app/layout.tsx` to add PostHogProvider**

The `AppProviders` function fetches the cart. We need to also resolve the PostHog distinct ID and feature flags, then pass them to the provider.

```typescript
import { PostHogProvider } from "components/providers/posthog-provider"
import { retrieveCustomer } from "lib/medusa/customer"
import { getPostHogAnonId } from "lib/posthog-cookies"

async function AppProviders({ children }: { children: ReactNode }) {
  const cartPromise = getCart()

  // Resolve PostHog identity
  const customer = await retrieveCustomer()
  const anonId = await getPostHogAnonId()
  const distinctId = customer?.id || anonId || null

  return (
    <CartProvider cartPromise={cartPromise}>
      <PostHogProvider bootstrapDistinctId={distinctId}>
        <NotificationProvider>
          <SearchProvider>
            <NotificationContainer />
            <SearchDialog />
            <Navbar />
            <main>{children}</main>
            <Footer />
          </SearchProvider>
        </NotificationProvider>
      </PostHogProvider>
    </CartProvider>
  )
}
```

> **Note:** Feature flag bootstrapping is deferred to Task 7. For now, omit the `bootstrapFlags` prop.

- [ ] **Step 3: Add client events to cart, product, search, filter, navbar, review, and checkout components**

For each component listed in the Modified Files section above:

1. Read the file to understand where the interaction happens
2. Add `import { trackClient } from "lib/analytics"` at the top
3. Add `trackClient(eventName, properties)` at the interaction point

**Pattern for each component:**

- `components/cart/index.tsx` — find the `setOpen(true)` or equivalent cart open trigger, add `trackClient("cart_drawer_opened", {})`
- `components/product/product-card-with-quick-view.tsx` — find `setQuickViewOpen(true)`, add `trackClient("product_quick_view_opened", { product_id })`
- `components/product/product-detail.tsx` — find color/size onChange, add `trackClient("product_variant_selected", { product_id, option_name, option_value })`; find TabGroup onChange for images, add `trackClient("product_image_viewed", { product_id, image_index })`; find Disclosure button, add `trackClient("product_details_expanded", { product_id, section_name })`
- `components/search-command/index.tsx` — find open/close handlers, add respective events
- `components/layout/search/sort-filter-menu.tsx` — find sort/filter selection handlers
- `components/layout/search/mobile-filters.tsx` — find dialog open trigger
- `components/layout/navbar/navbar-client.tsx` — find hamburger menu open
- `components/reviews/ProductReviews.tsx` — find "Write a Review" button handler
- `components/checkout/checkout-review.tsx` — find Edit button handlers + Stripe error handling
- `components/checkout/checkout-shipping.tsx` — find the "no shipping options" error path

> **READ EACH FILE BEFORE MODIFYING.** The exact variable names, handler locations, and component structures vary. Do not guess — verify the code structure first.

- [ ] **Step 4: Verify build**

```bash
cd storefront && bun run build
```

- [ ] **Step 5: Commit**

```bash
git add storefront/components/providers/posthog-provider.tsx storefront/app/layout.tsx storefront/components/cart/index.tsx storefront/components/product/ storefront/components/search-command/index.tsx storefront/components/layout/search/ storefront/components/layout/navbar/navbar-client.tsx storefront/components/reviews/ProductReviews.tsx storefront/components/checkout/checkout-review.tsx storefront/components/checkout/checkout-shipping.tsx
git commit -m "feat(storefront): add PostHog client provider, session replay, and client events

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Web Vitals + Remove Speed Insights

**Files:**
- Create: `storefront/app/web-vitals.tsx` — Web Vitals capture
- Modify: `storefront/app/layout.tsx` — add WebVitals, remove SpeedInsights
- Modify: `storefront/package.json` — remove @vercel/speed-insights

### Steps

- [ ] **Step 1: Create `storefront/app/web-vitals.tsx`**

```typescript
"use client"

import { useReportWebVitals } from "next/web-vitals"
import { useRef } from "react"

export function WebVitals() {
  // Stable per-session sampling: decide once on mount, reuse for all metric callbacks
  const shouldSample = useRef(Math.random() < 0.1)

  useReportWebVitals((metric) => {
    if (!shouldSample.current) return

    // Lazy import to avoid loading posthog-js if not sampling
    import("posthog-js").then((posthog) => {
      if (!posthog.default?.__loaded) return
      posthog.default.capture("web_vitals", {
        metric_name: metric.name, // LCP, CLS, INP, FCP, TTFB
        metric_value: metric.value,
        metric_rating: metric.rating, // "good", "needs-improvement", "poor"
        metric_delta: metric.delta,
        metric_id: metric.id,
        navigation_type: metric.navigationType,
      })
    })
  })

  return null
}
```

> **NOTE:** Verify `useReportWebVitals` is still exported from `next/web-vitals` in Next.js 16. Check Context7 docs. The import path may have changed.

- [ ] **Step 2: Remove @vercel/speed-insights**

```bash
cd storefront && bun remove @vercel/speed-insights
```

Check if `SpeedInsights` is imported/used anywhere:

```bash
grep -r "speed-insights\|SpeedInsights" storefront/app/ storefront/components/
```

Remove any imports and `<SpeedInsights />` components found (likely in `layout.tsx`, but check — it may not be currently rendered based on the layout.tsx we read).

Based on the layout.tsx read, `SpeedInsights` is NOT currently imported or rendered. It's just listed as a dependency. Removing the package is sufficient.

- [ ] **Step 3: Add WebVitals to `storefront/app/layout.tsx`**

```typescript
import { WebVitals } from "./web-vitals"

// Inside AppProviders, after the PostHogProvider:
<PostHogProvider bootstrapDistinctId={distinctId}>
  <WebVitals />
  ...
</PostHogProvider>
```

- [ ] **Step 4: Verify build**

```bash
cd storefront && bun run build
```

- [ ] **Step 5: Commit**

```bash
git add storefront/app/web-vitals.tsx storefront/app/layout.tsx storefront/package.json storefront/bun.lock
git commit -m "feat(storefront): add PostHog web vitals, remove @vercel/speed-insights

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Sentry Replay Config Change

**Files:**
- Modify: `storefront/instrumentation-client.ts` — change replay sample rate

### Steps

- [ ] **Step 1: Change Sentry replay config**

In `storefront/instrumentation-client.ts`, change:

```typescript
replaysSessionSampleRate: 0.1,
```

to:

```typescript
replaysSessionSampleRate: 0,
```

Keep `replaysOnErrorSampleRate: 1.0` unchanged. This makes Sentry only record replays on errors, while PostHog handles behavior recording.

- [ ] **Step 2: Verify build**

```bash
cd storefront && bun run build
```

- [ ] **Step 3: Commit**

```bash
git add storefront/instrumentation-client.ts
git commit -m "chore(storefront): disable Sentry general session replay, keep error-only

PostHog now handles behavior replay. Sentry records only error sessions.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Feature Flags + Experiments Infrastructure

**Files:**
- Create: `storefront/lib/feature-flags.ts` — flag evaluation + goal tracking
- Modify: `storefront/app/layout.tsx` — add flag bootstrapping to PostHogProvider
- Modify: `storefront/lib/analytics-server.ts` — add `trackGoal()` export

### Steps

- [ ] **Step 1: Create `storefront/lib/feature-flags.ts`**

```typescript
import "server-only"
import { getPostHogServer } from "./posthog-server"

export async function getFeatureFlag(
  flag: string,
  distinctId: string,
): Promise<boolean | string> {
  const posthog = getPostHogServer()
  if (!posthog) return false

  const value = await posthog.getFeatureFlag(flag, distinctId)
  return value ?? false
}

export async function getFeatureFlags(
  distinctId: string,
): Promise<Record<string, boolean | string>> {
  const posthog = getPostHogServer()
  if (!posthog) return {}

  const flags = await posthog.getAllFlags(distinctId)
  return flags as Record<string, boolean | string>
}
```

> **Verify API:** Check Context7 docs for `posthog.getFeatureFlag()` and `posthog.getAllFlags()` — the method names and return types may differ.

- [ ] **Step 2: Add `trackGoal()` to `storefront/lib/analytics-server.ts`**

```typescript
export async function trackGoal<E extends keyof AnalyticsEvents>(
  event: E,
  value?: number,
  distinctId?: string,
): Promise<void> {
  const posthog = getPostHogServer()
  if (!posthog) return

  const id = distinctId || (await resolveDistinctId())
  if (!id) return

  posthog.capture({
    distinctId: id,
    event,
    properties: {
      $set: { last_goal_event: event },
      ...(value !== undefined ? { value } : {}),
    },
  })
}
```

- [ ] **Step 3: Add flag bootstrapping to `storefront/app/layout.tsx`**

Update `AppProviders` to fetch flags and pass them to the provider:

```typescript
import { getFeatureFlags } from "lib/feature-flags"

async function AppProviders({ children }: { children: ReactNode }) {
  const cartPromise = getCart()

  const customer = await retrieveCustomer()
  const anonId = await getPostHogAnonId()
  const distinctId = customer?.id || anonId || null

  // Bootstrap feature flags (evaluated server-side, passed to client)
  const bootstrapFlags = distinctId ? await getFeatureFlags(distinctId) : {}

  return (
    <CartProvider cartPromise={cartPromise}>
      <PostHogProvider
        bootstrapDistinctId={distinctId}
        bootstrapFlags={bootstrapFlags}
      >
        <WebVitals />
        <NotificationProvider>
          ...
        </NotificationProvider>
      </PostHogProvider>
    </CartProvider>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
cd storefront && bun run build
```

- [ ] **Step 5: Commit**

```bash
git add storefront/lib/feature-flags.ts storefront/lib/analytics-server.ts storefront/app/layout.tsx
git commit -m "feat(storefront): add PostHog feature flags and experiments infrastructure

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Post-Implementation Verification

- [ ] **Step 1: Full build check**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/commerce-tailwindui-medusa && bun run build
```

- [ ] **Step 2: Manual smoke test (if PostHog env vars are configured)**

Start the dev server and verify:

1. Visit a product page → check PostHog for `product_viewed` event
2. Add to cart → check for `product_added_to_cart`
3. Open cart drawer → check for `cart_drawer_opened`
4. Navigate to checkout → check for `checkout_started`
5. Check session replay appears in PostHog dashboard with masked inputs
6. Check web vitals appear in PostHog
7. Verify no split users: anonymous → login → events appear under one person

- [ ] **Step 3: Verify no-op behavior without env vars**

Remove PostHog env vars from `.env.local` (or don't set them). Run `bun run build` and `bun dev`. The app should work identically with zero errors or warnings from PostHog code.
