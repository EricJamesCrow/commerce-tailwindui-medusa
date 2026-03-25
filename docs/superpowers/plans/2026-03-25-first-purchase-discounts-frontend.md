# First-Purchase Discounts — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible promo code input to the checkout order summary and a one-time discount popup for unauthenticated visitors, both using TailwindUI components.

**Architecture:** A new `PromoCodeInput` client component is extracted from `order-summary.tsx` (which stays a Server Component). Two server actions (`applyPromoCode`, `removePromoCode`) handle cart mutations. A `DiscountPopup` client component is wired into the root layout where the customer session is already fetched. E2E tests cover the happy path, error cases, and popup lifecycle.

**Tech Stack:** Next.js 15 App Router, Headless UI (`Disclosure`, `Dialog`), TailwindUI component patterns (Ecommerce > Shopping Carts, Marketing > Overlays), Zod, Playwright E2E, PostHog analytics, Sentry

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `storefront/lib/medusa/checkout-schemas.ts` | Add `promoCodeSchema` |
| Modify | `storefront/lib/analytics.ts` | Add 3 promo events to `AnalyticsEvents` type |
| Modify | `storefront/lib/medusa/checkout.ts` | Add `applyPromoCode`, `removePromoCode` server actions |
| Create | `storefront/components/checkout/promo-code-input.tsx` | Client component: collapsible input + chips |
| Modify | `storefront/components/checkout/order-summary.tsx` | Render `<PromoCodeInput>` below items list |
| Create | `storefront/components/common/discount-popup.tsx` | Client component: first-visit modal |
| Modify | `storefront/app/layout.tsx` | Render `<DiscountPopup isAuthenticated={!!customer}>` |
| Modify | `storefront/tests/e2e/helpers/selectors.ts` | Add promo code + popup selectors |
| Create | `storefront/tests/e2e/checkout/promo-code.spec.ts` | E2E: promo code input flows |
| Create | `storefront/tests/e2e/checkout/discount-popup.spec.ts` | E2E: popup lifecycle |

---

## Task 1: Add `promoCodeSchema` and analytics events

**Files:**
- Modify: `storefront/lib/medusa/checkout-schemas.ts`
- Modify: `storefront/lib/analytics.ts`

- [ ] **Step 1: Add `promoCodeSchema` to checkout-schemas.ts**

Open `storefront/lib/medusa/checkout-schemas.ts` and append at the bottom:

```ts
// Promo code: non-empty string, max 50 chars, normalized to uppercase
export const promoCodeSchema = z
  .string()
  .trim()
  .min(1, "Promo code is required")
  .max(50, "Promo code is too long")
  .transform((val) => val.toUpperCase());
```

- [ ] **Step 2: Add promo events to AnalyticsEvents type**

Open `storefront/lib/analytics.ts`. Find the `// --- Checkout ---` section and add after the `checkout_payment_success_order_failed` entry (before the closing `};`):

```ts
  // --- Promotions ---
  promo_code_applied: { cart_id: string; code: string };
  promo_code_removed: { cart_id: string; code: string };
  promo_code_failed: { cart_id: string; code: string; error: string };
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd storefront && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add storefront/lib/medusa/checkout-schemas.ts storefront/lib/analytics.ts
git commit -m "feat: add promoCodeSchema and promo analytics event types"
```

---

## Task 2: Add `applyPromoCode` and `removePromoCode` server actions

**Files:**
- Modify: `storefront/lib/medusa/checkout.ts`

The actions follow the same server-side pattern as `setCartEmail` in the same file: Zod validate → resolve the active cart from cookies/session → `assertSessionCart` → `sdk.client.fetch` → `revalidateCheckout()` → `trackServer`. Add these at the bottom of the file.

- [ ] **Step 1: Add the imports at the top of checkout.ts**

Find the existing imports block. Add `promoCodeSchema` to the import from `lib/medusa/checkout-schemas`:

```ts
import {
  addressSchema,
  emailSchema,
  paymentDataSchema,
  providerIdSchema,
  promoCodeSchema,
} from "lib/medusa/checkout-schemas";
```

- [ ] **Step 2: Add the two server actions at the bottom of checkout.ts**

```ts
// === Promo Codes ===

export async function applyPromoCode(
  code: string,
): Promise<string | null> {
  const codeResult = promoCodeSchema.safeParse(code);
  if (!codeResult.success) {
    return codeResult.error.issues[0]?.message ?? "Invalid promo code";
  }
  const normalizedCode = codeResult.data;

  const headers = await getAuthHeaders();
  const cartId = await getCartId();
  if (!cartId) {
    return "No active cart found";
  }

  try {
    await assertSessionCart(cartId);
    // Medusa v2 has dedicated endpoints for cart promotions — do NOT use
    // sdk.store.cart.update for this (its promo_codes field is string[], not {add/remove}).
    await sdk.client.fetch<{ cart: HttpTypes.StoreCart }>(
      `/store/carts/${cartId}/promotions`,
      { method: "POST", headers, body: { promo_codes: [normalizedCode] } }
    ).catch(medusaError);
    try {
      await trackServer("promo_code_applied", { cart_id: cartId, code: normalizedCode });
    } catch {}
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error applying promo code";
    Sentry.captureException(e, { tags: { action: "apply_promo_code", cart_id: cartId } });
    try {
      await trackServer("promo_code_failed", { cart_id: cartId, code: normalizedCode, error: message });
    } catch {}
    return message;
  } finally {
    revalidateCheckout();
  }

  return null;
}

export async function removePromoCode(
  code: string,
): Promise<string | null> {
  const codeResult = promoCodeSchema.safeParse(code);
  if (!codeResult.success) {
    return codeResult.error.issues[0]?.message ?? "Invalid promo code";
  }
  const normalizedCode = codeResult.data;

  const headers = await getAuthHeaders();
  const cartId = await getCartId();
  if (!cartId) {
    return "No active cart found";
  }

  try {
    await assertSessionCart(cartId);
    await sdk.client.fetch<{ cart: HttpTypes.StoreCart }>(
      `/store/carts/${cartId}/promotions`,
      { method: "DELETE", headers, body: { promo_codes: [normalizedCode] } }
    ).catch(medusaError);
    try {
      await trackServer("promo_code_removed", { cart_id: cartId, code: normalizedCode });
    } catch {}
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "remove_promo_code", cart_id: cartId } });
    return e instanceof Error ? e.message : "Error removing promo code";
  } finally {
    revalidateCheckout();
  }

  return null;
}
```

> **API note:** Medusa v2 exposes dedicated promotion endpoints (`POST` to add, `DELETE` to remove) at `/store/carts/:id/promotions`. Do not use `sdk.store.cart.update` for promotions — its `promo_codes` field is a flat `string[]` replacement, not an add/remove delta, and would clobber other promotions on the cart.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd storefront && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add storefront/lib/medusa/checkout.ts
git commit -m "feat: add applyPromoCode and removePromoCode server actions"
```

---

## Task 3: `PromoCodeInput` client component

**Files:**
- Create: `storefront/components/checkout/promo-code-input.tsx`

This is a client component that uses Headless UI `Disclosure` for the collapsible section. Reference the TailwindUI Ecommerce > Shopping Carts catalog entry from the team's shared Tailwind Plus resources and adapt the closest shopping-cart input pattern.

- [ ] **Step 1: Create the component**

```tsx
// storefront/components/checkout/promo-code-input.tsx
"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { XMarkIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { applyPromoCode, removePromoCode } from "lib/medusa/checkout";
import { useRef, useState, useTransition } from "react";
import type { HttpTypes } from "@medusajs/types";

type Props = {
  promotions: HttpTypes.StorePromotion[];
};

export function PromoCodeInput({ promotions }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const appliedCodes = promotions
    .map((p) => p.code)
    .filter((c): c is string => !!c);

  function handleApply() {
    const code = inputValue.trim();
    if (!code) return;
    setError(null);

    startTransition(async () => {
      const result = await applyPromoCode(code);
      if (result) {
        setError(result);
      } else {
        setInputValue("");
        inputRef.current?.focus();
      }
    });
  }

  function handleRemove(code: string) {
    setError(null);
    startTransition(async () => {
      const result = await removePromoCode(code);
      if (result) setError(result);
    });
  }

  return (
    <Disclosure as="div" className="border-t border-gray-200 pt-6">
      <DisclosureButton
        aria-label="Toggle promo code input"
        className="group flex w-full items-center justify-between text-sm font-medium text-gray-900"
      >
        <span>Have a promo code?</span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-5 text-gray-500 transition-transform group-data-open:rotate-180"
        />
      </DisclosureButton>

      <DisclosurePanel className="mt-4 space-y-3">
        {/* Applied code chips */}
        {appliedCodes.length > 0 && (
          <ul
            aria-label="Applied promo codes"
            className="flex flex-wrap gap-2"
          >
            {appliedCodes.map((code) => (
              <li
                key={code}
                className="flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
              >
                <span>{code}</span>
                <button
                  type="button"
                  aria-label={`Remove promo code ${code}`}
                  disabled={isPending}
                  onClick={() => handleRemove(code)}
                  className="ml-1 rounded-full p-0.5 text-primary-500 hover:text-primary-700 disabled:opacity-50"
                >
                  <XMarkIcon aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Input row */}
        <div className="flex gap-2">
          <label htmlFor="promo-code-input" className="sr-only">
            Promo code
          </label>
          <input
            id="promo-code-input"
            ref={inputRef}
            type="text"
            name="promo-code"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply();
              }
            }}
            placeholder="Enter code"
            autoComplete="off"
            disabled={isPending}
            aria-describedby={error ? "promo-code-error" : undefined}
            className={clsx(
              "block w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm",
              "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
              "disabled:opacity-50",
              error ? "border-red-300" : "border-gray-300"
            )}
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={isPending || !inputValue.trim()}
            className={clsx(
              "shrink-0 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm",
              "hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isPending ? "Applying…" : "Apply"}
          </button>
        </div>

        {/* Inline error */}
        {error && (
          <p id="promo-code-error" role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </DisclosurePanel>
    </Disclosure>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd storefront && bunx tsc --noEmit
```

Expected: no errors. If `HttpTypes.StorePromotion` doesn't expose a `code` field, check the actual type with `HttpTypes.StorePromotion` in your editor and adjust the `appliedCodes` accessor.

- [ ] **Step 3: Commit**

```bash
git add storefront/components/checkout/promo-code-input.tsx
git commit -m "feat: add PromoCodeInput client component"
```

---

## Task 4: Wire `PromoCodeInput` into `order-summary.tsx`

**Files:**
- Modify: `storefront/components/checkout/order-summary.tsx`

`order-summary.tsx` is currently a Server Component. It stays that way — `PromoCodeInput` is the only interactive piece.

- [ ] **Step 1: Add the import**

At the top of `storefront/components/checkout/order-summary.tsx`, add:

```ts
import { PromoCodeInput } from "components/checkout/promo-code-input";
```

- [ ] **Step 2: Render `<PromoCodeInput>` below the items list**

Find the closing `</div>` after the `<ul>` items list (around the `flow-root` div). Add the `PromoCodeInput` after it and before the totals `<dl>`:

```tsx
      </div>  {/* end flow-root */}

      <PromoCodeInput promotions={cart.promotions ?? []} />

      <dl className="mt-10 space-y-6 ...">
```

The full updated `OrderSummary` render after the items list should look like:

```tsx
      </div>

      <PromoCodeInput promotions={cart.promotions ?? []} />

      <dl className="mt-10 space-y-6 text-sm font-medium text-gray-500">
        {/* ... existing totals rows ... */}
      </dl>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd storefront && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add storefront/components/checkout/order-summary.tsx
git commit -m "feat: add PromoCodeInput to checkout order summary"
```

---

## Task 5: `DiscountPopup` component

**Files:**
- Create: `storefront/components/common/discount-popup.tsx`

This uses Headless UI `Dialog`. Reference the TailwindUI Marketing > Overlays entry from the team's shared Tailwind Plus resources, then adapt the closest overlay/modal component for this flow.

- [ ] **Step 1: Create the component**

```tsx
// storefront/components/common/discount-popup.tsx
"use client";

import {
  Dialog,
  DialogPanel,
  DialogBackdrop,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import Link from "next/link";

const POPUP_SESSION_KEY = "discount_popup_shown";

type Props = {
  isAuthenticated: boolean;
};

export function DiscountPopup({ isAuthenticated }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) return;
    if (sessionStorage.getItem(POPUP_SESSION_KEY)) return;

    const timer = setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem(POPUP_SESSION_KEY, "1");
    }, 800);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  function close() {
    setOpen(false);
  }

  if (isAuthenticated) return null;

  return (
    <Dialog open={open} onClose={close} className="relative z-50">
      {/* Backdrop */}
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          <DialogPanel
            transition
            className="relative transform overflow-hidden rounded-2xl bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:px-6 sm:pt-6"
          >
            {/* Close button */}
            <div className="absolute top-0 right-0 pt-4 pr-4">
              <button
                type="button"
                onClick={close}
                aria-label="Dismiss"
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>
            </div>

            {/* Content */}
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-100">
                {/* Tag icon — inline SVG to avoid extra dependency */}
                <svg
                  className="size-6 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 6h.008v.008H6V6Z"
                  />
                </svg>
              </div>

              <div className="mt-3 sm:mt-5">
                <h3 className="text-lg font-semibold text-gray-900">
                  10% off your first order
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Create a free account and get 10% off automatically applied
                  at checkout — no code needed.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 sm:mt-6 space-y-3">
              <Link
                href="/account?view=register"
                onClick={close}
                className="block w-full rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                Create an account
              </Link>
              <button
                type="button"
                onClick={close}
                className="block w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Maybe later
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd storefront && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add storefront/components/common/discount-popup.tsx
git commit -m "feat: add DiscountPopup client component"
```

---

## Task 6: Wire `DiscountPopup` into the root layout

**Files:**
- Modify: `storefront/app/layout.tsx`

The root layout's `AppProviders` function already calls `retrieveCustomer()` and has `customer` in scope. This is the right place to add the popup — no new data fetching needed.

- [ ] **Step 1: Add the import**

In `storefront/app/layout.tsx`, add with the other component imports:

```ts
import { DiscountPopup } from "components/common/discount-popup";
```

- [ ] **Step 2: Render `<DiscountPopup>` inside `AppProviders`**

Inside the `AppProviders` function, add `<DiscountPopup isAuthenticated={!!customer} />` just before the closing `</SearchProvider>` tag (it needs to be inside `NotificationProvider` and `SearchProvider` for portal rendering to work correctly):

```tsx
        <NotificationProvider>
          <SearchProvider>
            <NotificationContainer />
            <SearchDialog />
            <Navbar />
            <main>{children}</main>
            <Incentives />
            <Footer />
            <DiscountPopup isAuthenticated={!!customer} />
          </SearchProvider>
        </NotificationProvider>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd storefront && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add storefront/app/layout.tsx
git commit -m "feat: render DiscountPopup in root layout"
```

---

## Task 7: Add selectors

**Files:**
- Modify: `storefront/tests/e2e/helpers/selectors.ts`

Selectors are centralized here — tests import from this file so they don't embed brittle CSS selectors directly.

- [ ] **Step 1: Append promo code and popup selectors**

Open `storefront/tests/e2e/helpers/selectors.ts` and add at the bottom:

```ts
// Promo code input (checkout order summary)
export const PROMO_CODE_TOGGLE = 'button[aria-label="Toggle promo code input"]';
export const PROMO_CODE_INPUT = '#promo-code-input';
export const PROMO_CODE_APPLY_BUTTON = 'button:has-text("Apply")';
export const PROMO_CODE_CHIP = (code: string) =>
  `li:has(span:has-text("${code}"))`;
export const PROMO_CODE_REMOVE_BUTTON = (code: string) =>
  `button[aria-label="Remove promo code ${code}"]`;
export const PROMO_CODE_ERROR = '#promo-code-error';
export const ORDER_SUMMARY_DISCOUNT_ROW = 'dt:has-text("Discount")';

// Discount popup
export const DISCOUNT_POPUP = 'h3:has-text("10% off your first order")';
export const DISCOUNT_POPUP_CREATE_ACCOUNT = 'a:has-text("Create an account")';
export const DISCOUNT_POPUP_DISMISS = 'button[aria-label="Dismiss"]';
export const DISCOUNT_POPUP_MAYBE_LATER = 'button:has-text("Maybe later")';
```

- [ ] **Step 2: Commit**

```bash
git add storefront/tests/e2e/helpers/selectors.ts
git commit -m "test: add promo code and discount popup selectors"
```

---

## Task 8: E2E tests — promo code input

**Files:**
- Create: `storefront/tests/e2e/checkout/promo-code.spec.ts`

Tests run against a live dev server. They require:
- A valid promo code to exist in Medusa (create one in the admin, e.g. `TESTDISCOUNT10` — 10% off, no restrictions). Store the code as `VALID_PROMO_CODE` constant below.
- The backend to be running at http://localhost:9000

- [ ] **Step 1: Create the test file**

```ts
// storefront/tests/e2e/checkout/promo-code.spec.ts
import { test, expect } from "../fixtures/checkout.fixture";
import * as sel from "../helpers/selectors";

// A valid promotion code that must exist in the Medusa admin.
// Create it before running: code = TESTDISCOUNT10, 10% off, no restrictions.
const VALID_PROMO_CODE = "TESTDISCOUNT10";
const INVALID_PROMO_CODE = "THISDOESNOTEXIST999";

test.describe("Promo Code Input", () => {
  test("promo code toggle is visible on checkout", async ({
    guestCheckoutPage: page,
  }) => {
    await expect(
      page.locator(sel.ORDER_SUMMARY_ITEM).first()
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.locator(sel.PROMO_CODE_TOGGLE)).toBeVisible();
  });

  test("clicking toggle reveals the promo code input", async ({
    guestCheckoutPage: page,
  }) => {
    await expect(
      page.locator(sel.ORDER_SUMMARY_ITEM).first()
    ).toBeVisible({ timeout: 15_000 });

    // Input should be hidden initially
    await expect(page.locator(sel.PROMO_CODE_INPUT)).not.toBeVisible();

    // Click toggle to reveal
    await page.locator(sel.PROMO_CODE_TOGGLE).click();
    await expect(page.locator(sel.PROMO_CODE_INPUT)).toBeVisible();
  });

  test("applying an invalid code shows an inline error", async ({
    guestCheckoutPage: page,
  }) => {
    await expect(
      page.locator(sel.ORDER_SUMMARY_ITEM).first()
    ).toBeVisible({ timeout: 15_000 });

    await page.locator(sel.PROMO_CODE_TOGGLE).click();
    await page.locator(sel.PROMO_CODE_INPUT).fill(INVALID_PROMO_CODE);
    await page.locator(sel.PROMO_CODE_APPLY_BUTTON).click();

    await expect(page.locator(sel.PROMO_CODE_ERROR)).toBeVisible({
      timeout: 10_000,
    });
    // No chip should appear for an invalid code
    await expect(
      page.locator(sel.PROMO_CODE_CHIP(INVALID_PROMO_CODE))
    ).not.toBeVisible();
  });

  test("applying a valid code shows a chip and clears the input", async ({
    guestCheckoutPage: page,
  }) => {
    await expect(
      page.locator(sel.ORDER_SUMMARY_ITEM).first()
    ).toBeVisible({ timeout: 15_000 });

    await page.locator(sel.PROMO_CODE_TOGGLE).click();
    await page.locator(sel.PROMO_CODE_INPUT).fill(VALID_PROMO_CODE);
    await page.locator(sel.PROMO_CODE_APPLY_BUTTON).click();

    // Chip appears
    await expect(
      page.locator(sel.PROMO_CODE_CHIP(VALID_PROMO_CODE))
    ).toBeVisible({ timeout: 10_000 });

    // Input is cleared
    await expect(page.locator(sel.PROMO_CODE_INPUT)).toHaveValue("");

    // No error shown
    await expect(page.locator(sel.PROMO_CODE_ERROR)).not.toBeVisible();
  });

  test("removing an applied code removes the chip", async ({
    guestCheckoutPage: page,
  }) => {
    await expect(
      page.locator(sel.ORDER_SUMMARY_ITEM).first()
    ).toBeVisible({ timeout: 15_000 });

    // Apply first
    await page.locator(sel.PROMO_CODE_TOGGLE).click();
    await page.locator(sel.PROMO_CODE_INPUT).fill(VALID_PROMO_CODE);
    await page.locator(sel.PROMO_CODE_APPLY_BUTTON).click();
    await expect(
      page.locator(sel.PROMO_CODE_CHIP(VALID_PROMO_CODE))
    ).toBeVisible({ timeout: 10_000 });

    // Then remove
    await page.locator(sel.PROMO_CODE_REMOVE_BUTTON(VALID_PROMO_CODE)).click();
    await expect(
      page.locator(sel.PROMO_CODE_CHIP(VALID_PROMO_CODE))
    ).not.toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 2: Run the tests (requires dev server running)**

```bash
cd storefront && bunx playwright test tests/e2e/checkout/promo-code.spec.ts --project=chromium
```

Expected: all tests pass. If `VALID_PROMO_CODE` doesn't exist in Medusa yet, the "applying a valid code" and "removing an applied code" tests will fail — create the promotion in the admin first.

- [ ] **Step 3: Commit**

```bash
git add storefront/tests/e2e/checkout/promo-code.spec.ts
git commit -m "test: add promo code E2E test suite"
```

---

## Task 9: E2E tests — discount popup

**Files:**
- Create: `storefront/tests/e2e/checkout/discount-popup.spec.ts`

- [ ] **Step 1: Create the test file**

```ts
// storefront/tests/e2e/checkout/discount-popup.spec.ts
import { test, expect } from "@playwright/test";
import * as sel from "../helpers/selectors";

test.describe("Discount Popup", () => {
  test.beforeEach(async ({ page }) => {
    // Clear sessionStorage before each test so popup can appear
    await page.addInitScript(() => {
      sessionStorage.removeItem("discount_popup_shown");
    });
  });

  test("popup appears for unauthenticated visitors after a short delay", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.DISCOUNT_POPUP)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("dismissing the popup with the × button closes it", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.DISCOUNT_POPUP)).toBeVisible({
      timeout: 5_000,
    });
    await page.locator(sel.DISCOUNT_POPUP_DISMISS).click();
    await expect(page.locator(sel.DISCOUNT_POPUP)).not.toBeVisible({
      timeout: 3_000,
    });
  });

  test("dismissing with Maybe Later closes the popup", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.DISCOUNT_POPUP)).toBeVisible({
      timeout: 5_000,
    });
    await page.locator(sel.DISCOUNT_POPUP_MAYBE_LATER).click();
    await expect(page.locator(sel.DISCOUNT_POPUP)).not.toBeVisible({
      timeout: 3_000,
    });
  });

  test("popup does not reappear after dismissal within the same session", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.DISCOUNT_POPUP)).toBeVisible({
      timeout: 5_000,
    });
    await page.locator(sel.DISCOUNT_POPUP_DISMISS).click();

    // Navigate away and back
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Popup should NOT appear again (sessionStorage key is set)
    await page.waitForTimeout(1_500);
    await expect(page.locator(sel.DISCOUNT_POPUP)).not.toBeVisible();
  });

  test("Create an account CTA navigates to registration page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.DISCOUNT_POPUP)).toBeVisible({
      timeout: 5_000,
    });
    await page.locator(sel.DISCOUNT_POPUP_CREATE_ACCOUNT).click();
    await page.waitForURL("**/account**", { timeout: 10_000 });
    expect(page.url()).toContain("view=register");
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd storefront && bunx playwright test tests/e2e/checkout/discount-popup.spec.ts --project=chromium
```

Expected: all tests pass.

> **Fixture note:** This spec imports `{ test, expect }` directly from `@playwright/test` (the base, not a custom fixture). The popup tests navigate to `/` as a plain guest — no cart needed. The `addInitScript` clears `sessionStorage` before each test so the popup fires. Do NOT import from `checkout.fixture.ts` (that fixture navigates to `/checkout`, not `/`).

- [ ] **Step 3: Commit**

```bash
git add storefront/tests/e2e/checkout/discount-popup.spec.ts
git commit -m "test: add discount popup E2E test suite"
```

---

## Task 10: Final typecheck

- [ ] **Step 1: Full storefront typecheck**

```bash
cd storefront && bunx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Lint check**

```bash
cd storefront && bun run prettier --check .
```

Expected: no unformatted files. If there are, run `bun run prettier --write .` and commit the formatting fixes.

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add <changed files>
git commit -m "chore: formatting and typecheck fixes"
```
