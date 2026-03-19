# Stripe Checkout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full checkout flow with Stripe Payment Element, saved payment methods, guest + authenticated flows, and order confirmation.

**Architecture:** Cart-state-driven steps on a single `/checkout` page. RSC shell fetches cart + customer, passes to a client-side `CheckoutForm` with accordion stepper. Server actions handle each step mutation, revalidating the cart tag so RSC re-renders with fresh data. Stripe Elements mount when payment session exists.

**Tech Stack:** Next.js 16, Medusa v2 SDK, Stripe Payment Element (`@stripe/react-stripe-js`), TailwindCSS v4, Headless UI, clsx

**Design doc:** `docs/plans/2026-02-23-stripe-checkout-design.md`

**IMPORTANT routing note:** Checkout pages go at `app/checkout/` (top level), NOT `app/(store)/checkout/`. The `(store)` route group has a product grid layout with collections sidebar that must not wrap the checkout.

---

## Task 1: Backend — Stripe Module Provider

**Files:**
- Modify: `backend/medusa-config.ts`

**Step 1: Add Stripe payment provider to medusa-config.ts**

Add the payment module with Stripe provider to the existing `modules` array:

```ts
// In medusa-config.ts, replace the modules array:
modules: [
  {
    resolve: "./src/modules/product-review",
  },
  {
    resolve: "./src/modules/wishlist",
  },
  {
    resolve: "@medusajs/medusa/payment",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/payment-stripe",
          id: "stripe",
          options: {
            apiKey: process.env.STRIPE_API_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            capture: false,
            automatic_payment_methods: true,
          },
        },
      ],
    },
  },
],
```

**Step 2: Run the backend to verify config loads**

Run: `cd backend && bun run dev`
Expected: Backend starts without config errors. Look for payment module initialization in logs.

**Step 3: Run database migration**

Run: `cd backend && bunx medusa db:migrate`
Expected: Migration runs successfully (Medusa creates payment tables if needed).

**Step 4: Commit**

```bash
git add backend/medusa-config.ts
git commit -m "feat(backend): add Stripe payment module provider

Configure @medusajs/medusa/payment-stripe with manual capture and
automatic_payment_methods enabled. Webhooks handled at
/hooks/payment/stripe_stripe.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Post-task note:** After the backend is running, enable Stripe in Medusa Admin: Settings > Regions > [your region] > Payment Providers > enable "Stripe". This is a manual step in the Admin UI.

---

## Task 2: Backend — Saved Payment Methods API Route

**Files:**
- Create: `backend/src/api/store/payment-methods/[account_holder_id]/route.ts`
- Modify: `backend/src/api/middlewares.ts`

**Step 1: Create the saved payment methods route**

Create `backend/src/api/store/payment-methods/[account_holder_id]/route.ts`:

```ts
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { account_holder_id } = req.params
  const query = req.scope.resolve("query")
  const paymentModuleService = req.scope.resolve("payment")

  const {
    data: [accountHolder],
  } = await query.graph({
    entity: "account_holder",
    fields: ["data", "provider_id"],
    filters: { id: account_holder_id },
  })

  if (!accountHolder) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Account holder not found"
    )
  }

  const paymentMethods = await paymentModuleService.listPaymentMethods({
    provider_id: accountHolder.provider_id,
    context: {
      account_holder: {
        data: { id: accountHolder.data.id },
      },
    },
  })

  res.json({ payment_methods: paymentMethods })
}
```

**Step 2: Add auth middleware**

In `backend/src/api/middlewares.ts`, add to the `routes` array:

```ts
// --- Saved payment methods — auth required ---
{
  matcher: "/store/payment-methods/:account_holder_id",
  method: "GET",
  middlewares: [
    authenticate("customer", ["bearer", "session"]),
  ],
},
```

**Step 3: Verify backend starts**

Run: `cd backend && bun run dev`
Expected: No errors. The route is registered.

**Step 4: Commit**

```bash
git add backend/src/api/store/payment-methods/[account_holder_id]/route.ts backend/src/api/middlewares.ts
git commit -m "feat(backend): add saved payment methods API route

GET /store/payment-methods/:account_holder_id returns saved cards from
Stripe via Medusa's payment module. Protected by customer auth middleware.
Follows official Medusa saved-payment-methods tutorial.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Storefront — Install Stripe Packages

**Step 1: Install packages**

Run from project root:
```bash
cd storefront && bun add @stripe/stripe-js @stripe/react-stripe-js
```

**Step 2: Verify install**

Run: `cd storefront && bun run build`
Expected: Build succeeds. No type errors.

**Step 3: Commit**

```bash
git add storefront/package.json storefront/bun.lock
git commit -m "chore(storefront): add Stripe.js and React Stripe packages

Install @stripe/stripe-js and @stripe/react-stripe-js for Payment Element
integration.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Storefront — Checkout Types

**Files:**
- Modify: `storefront/lib/types.ts`

**Step 1: Add checkout types**

Append these types to the end of `storefront/lib/types.ts`:

```ts
// --- Checkout ---

export type CheckoutStep = "email" | "address" | "shipping" | "payment" | "review"

export type AddressPayload = {
  first_name: string
  last_name: string
  address_1: string
  address_2?: string
  company?: string
  city: string
  country_code: string
  province?: string
  postal_code: string
  phone?: string
}

export type ShippingOption = {
  id: string
  name: string
  price_type: "flat" | "calculated"
  amount: number
  currency_code: string
}

export type SavedPaymentMethod = {
  id: string
  provider_id: string
  data: {
    card: {
      brand: string
      last4: string
      exp_month: number
      exp_year: number
    }
  }
}

export type CartCompletionResult =
  | { type: "order"; order: any }
  | { type: "cart"; error: string }
```

**Step 2: Typecheck**

Run: `cd storefront && bun run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add storefront/lib/types.ts
git commit -m "feat(storefront): add checkout type definitions

Add CheckoutStep, AddressPayload, ShippingOption, SavedPaymentMethod,
and CartCompletionResult types.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Storefront — Checkout Server Actions

**Files:**
- Create: `storefront/lib/medusa/checkout.ts`
- Modify: `storefront/components/cart/actions.ts` (update `redirectToCheckout`)

This is the data layer for the entire checkout flow. Follow the exact patterns from `components/cart/actions.ts` and `lib/medusa/customer.ts`.

**Step 1: Create checkout.ts**

Create `storefront/lib/medusa/checkout.ts`:

```ts
"use server";

import type { HttpTypes } from "@medusajs/types";
import { TAGS } from "lib/constants";
import { sdk } from "lib/medusa";
import { getAuthHeaders, getCartId, removeCartId } from "lib/medusa/cookies";
import { medusaError } from "lib/medusa/error";
import type {
  AddressPayload,
  CartCompletionResult,
  SavedPaymentMethod,
  ShippingOption,
} from "lib/types";
import { revalidatePath, revalidateTag } from "next/cache";

function revalidateCheckout(): void {
  revalidateTag(TAGS.cart, "max");
  revalidatePath("/", "layout");
}

// === Retrieve raw cart (not transformed) for checkout ===

export async function getCheckoutCart(): Promise<HttpTypes.StoreCart | null> {
  const cartId = await getCartId();
  if (!cartId) return null;

  const headers = await getAuthHeaders();

  try {
    const { cart } = await sdk.client.fetch<{
      cart: HttpTypes.StoreCart;
    }>(`/store/carts/${cartId}`, {
      method: "GET",
      headers,
      query: {
        fields:
          "*items,*items.product,*items.variant,*items.thumbnail,+items.total,*promotions,+shipping_methods.name,*payment_collection.payment_sessions",
      },
    });
    return cart;
  } catch (error) {
    console.error("[Checkout] Failed to retrieve cart:", error);
    return null;
  }
}

// === Cart Email ===

export async function setCartEmail(
  cartId: string,
  email: string,
): Promise<string | null> {
  const headers = await getAuthHeaders();

  try {
    await sdk.store.cart
      .update(cartId, { email }, {}, headers)
      .catch(medusaError);
  } catch (e) {
    return e instanceof Error ? e.message : "Error setting email";
  } finally {
    revalidateCheckout();
  }

  return null;
}

// === Addresses ===

export async function setCartAddresses(
  cartId: string,
  shipping: AddressPayload,
  billing?: AddressPayload,
): Promise<string | null> {
  const headers = await getAuthHeaders();
  const billingAddress = billing || shipping;

  try {
    await sdk.store.cart
      .update(
        cartId,
        {
          shipping_address: shipping,
          billing_address: billingAddress,
        },
        {},
        headers,
      )
      .catch(medusaError);
  } catch (e) {
    return e instanceof Error ? e.message : "Error setting addresses";
  } finally {
    revalidateCheckout();
  }

  return null;
}

// === Shipping Options ===

export async function getShippingOptions(
  cartId: string,
): Promise<ShippingOption[]> {
  const headers = await getAuthHeaders();

  try {
    const { shipping_options } = await sdk.client.fetch<{
      shipping_options: any[];
    }>("/store/shipping-options", {
      method: "GET",
      headers,
      query: { cart_id: cartId },
    });

    return shipping_options.map((opt) => ({
      id: opt.id,
      name: opt.name,
      price_type: opt.price_type || "flat",
      amount: opt.amount ?? 0,
      currency_code: opt.currency_code || "USD",
    }));
  } catch (error) {
    console.error("[Checkout] Failed to fetch shipping options:", error);
    return [];
  }
}

export async function setShippingMethod(
  cartId: string,
  optionId: string,
): Promise<string | null> {
  const headers = await getAuthHeaders();

  try {
    await sdk.store.cart
      .addShippingMethod(cartId, { option_id: optionId }, {}, headers)
      .catch(medusaError);
  } catch (e) {
    return e instanceof Error ? e.message : "Error setting shipping method";
  } finally {
    revalidateCheckout();
  }

  return null;
}

// === Payment ===

export async function initializePaymentSession(
  cartId: string,
  providerId: string,
  data?: Record<string, unknown>,
): Promise<string | null> {
  const headers = await getAuthHeaders();

  try {
    // First, get the current cart to pass to initiatePaymentSession
    const { cart } = await sdk.client.fetch<{
      cart: HttpTypes.StoreCart;
    }>(`/store/carts/${cartId}`, {
      method: "GET",
      headers,
      query: { fields: "*payment_collection.payment_sessions" },
    });

    await sdk.store.payment
      .initiatePaymentSession(cart, { provider_id: providerId, data }, {}, headers)
      .catch(medusaError);
  } catch (e) {
    return e instanceof Error ? e.message : "Error initializing payment";
  } finally {
    revalidateCheckout();
  }

  return null;
}

// === Saved Payment Methods ===

export async function getSavedPaymentMethods(
  accountHolderId: string,
): Promise<SavedPaymentMethod[]> {
  const headers = await getAuthHeaders();

  try {
    const { payment_methods } = await sdk.client.fetch<{
      payment_methods: SavedPaymentMethod[];
    }>(`/store/payment-methods/${accountHolderId}`, {
      method: "GET",
      headers,
    });
    return payment_methods;
  } catch {
    return [];
  }
}

// === Complete Cart ===

export async function completeCart(
  cartId: string,
): Promise<CartCompletionResult> {
  const headers = await getAuthHeaders();

  try {
    const result = await sdk.store.cart
      .complete(cartId, {}, headers)
      .catch(medusaError);

    if (result.type === "order") {
      await removeCartId();
      revalidateTag(TAGS.cart, "max");
      revalidatePath("/", "layout");
      return { type: "order", order: result.order };
    }

    return { type: "cart", error: result.error || "Payment could not be completed" };
  } catch (e) {
    return {
      type: "cart",
      error: e instanceof Error ? e.message : "Error completing order",
    };
  }
}

// === Customer Addresses (for saved address picker) ===

export async function getCustomerAddresses(): Promise<
  HttpTypes.StoreCustomerAddress[]
> {
  const headers = await getAuthHeaders();
  if (!("authorization" in headers)) return [];

  try {
    const { addresses } = await sdk.client.fetch<{
      addresses: HttpTypes.StoreCustomerAddress[];
    }>("/store/customers/me/addresses", {
      method: "GET",
      headers,
    });
    return addresses;
  } catch {
    return [];
  }
}
```

**Step 2: Update redirectToCheckout**

In `storefront/components/cart/actions.ts`, change:

```ts
// FROM:
export async function redirectToCheckout() {
  redirect("/cart");
}

// TO:
export async function redirectToCheckout() {
  redirect("/checkout");
}
```

**Step 3: Typecheck**

Run: `cd storefront && bun run typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add storefront/lib/medusa/checkout.ts storefront/components/cart/actions.ts
git commit -m "feat(storefront): add checkout server actions and data layer

All checkout mutations: setCartEmail, setCartAddresses, setShippingMethod,
initializePaymentSession, completeCart, getSavedPaymentMethods, etc.
Follows established patterns from cart/actions.ts and customer.ts.
Update redirectToCheckout to point to /checkout.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Storefront — Checkout Page Shell + Order Summary

**Files:**
- Create: `storefront/app/checkout/page.tsx`
- Create: `storefront/components/checkout/order-summary.tsx`

**Step 1: Create the checkout page RSC**

Create `storefront/app/checkout/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCheckoutCart } from "lib/medusa/checkout";
import { retrieveCustomer } from "lib/medusa/customer";
import { CheckoutForm } from "components/checkout/checkout-form";
import { OrderSummary } from "components/checkout/order-summary";

export const metadata = {
  title: "Checkout",
};

export default async function CheckoutPage() {
  const cart = await getCheckoutCart();

  if (!cart || !cart.items?.length) {
    redirect("/");
  }

  const customer = await retrieveCustomer();

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pb-24 sm:pt-8 lg:px-8 xl:px-2 xl:pt-14">
        <h1 className="sr-only">Checkout</h1>

        <div className="mx-auto grid max-w-lg grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
          <div className="mx-auto w-full max-w-lg">
            <CheckoutForm cart={cart} customer={customer} />
          </div>

          <div className="mx-auto w-full max-w-lg">
            <OrderSummary cart={cart} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create OrderSummary component**

Create `storefront/components/checkout/order-summary.tsx`:

```tsx
import type { HttpTypes } from "@medusajs/types";

function formatMoney(amount: number | undefined, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
  }).format(amount ?? 0);
}

export function OrderSummary({ cart }: { cart: HttpTypes.StoreCart }) {
  const currencyCode = cart.currency_code || "USD";

  return (
    <>
      <h2 className="sr-only">Order summary</h2>

      <div className="flow-root">
        <ul role="list" className="-my-6 divide-y divide-gray-200">
          {(cart.items || []).map((item) => (
            <li key={item.id} className="flex space-x-6 py-6">
              <img
                alt={item.product?.title || item.title || ""}
                src={item.thumbnail || item.product?.thumbnail || ""}
                className="size-24 flex-none rounded-md bg-gray-100 object-cover"
              />
              <div className="flex-auto">
                <div className="space-y-1 sm:flex sm:items-start sm:justify-between sm:space-x-6">
                  <div className="flex-auto space-y-1 text-sm font-medium">
                    <h3 className="text-gray-900">{item.product?.title || item.title}</h3>
                    <p className="text-gray-900">
                      {formatMoney(item.total, currencyCode)}
                    </p>
                    {item.variant?.title && item.variant.title !== "Default" && (
                      <p className="hidden text-gray-500 sm:block">
                        {item.variant.title}
                      </p>
                    )}
                    {item.quantity > 1 && (
                      <p className="text-gray-500">Qty: {item.quantity}</p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <dl className="mt-10 space-y-6 text-sm font-medium text-gray-500">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd className="text-gray-900">
            {formatMoney(cart.subtotal, currencyCode)}
          </dd>
        </div>
        {(cart.shipping_total ?? 0) > 0 && (
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd className="text-gray-900">
              {formatMoney(cart.shipping_total, currencyCode)}
            </dd>
          </div>
        )}
        {(cart.tax_total ?? 0) > 0 && (
          <div className="flex justify-between">
            <dt>Taxes</dt>
            <dd className="text-gray-900">
              {formatMoney(cart.tax_total, currencyCode)}
            </dd>
          </div>
        )}
        {(cart.discount_total ?? 0) > 0 && (
          <div className="flex justify-between">
            <dt>Discount</dt>
            <dd className="text-gray-900">
              -{formatMoney(cart.discount_total, currencyCode)}
            </dd>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-200 pt-6 text-gray-900">
          <dt className="text-base">Total</dt>
          <dd className="text-base">
            {formatMoney(cart.total, currencyCode)}
          </dd>
        </div>
      </dl>
    </>
  );
}
```

**Step 3: Create a placeholder CheckoutForm so the page renders**

Create `storefront/components/checkout/checkout-form.tsx`:

```tsx
"use client";

import type { HttpTypes } from "@medusajs/types";

export function CheckoutForm({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart;
  customer: HttpTypes.StoreCustomer | null;
}) {
  return (
    <div>
      <p className="text-sm text-gray-500">
        Checkout form placeholder — steps will be added in subsequent tasks.
      </p>
    </div>
  );
}
```

**Step 4: Verify the page renders**

Run: `cd storefront && bun dev`
Navigate to: `http://localhost:3000/checkout` (with items in cart)
Expected: Two-column layout with placeholder form on left and order summary on right. Redirects to `/` if cart is empty.

**Step 5: Commit**

```bash
git add storefront/app/checkout/page.tsx storefront/components/checkout/order-summary.tsx storefront/components/checkout/checkout-form.tsx
git commit -m "feat(storefront): add checkout page shell with order summary

RSC checkout page with cart guard (redirects if empty). Two-column layout
based on TailwindUI Multi-step checkout. OrderSummary shows items, subtotal,
shipping, taxes, discount, and total.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Storefront — CheckoutForm Accordion + Email Step

**Files:**
- Modify: `storefront/components/checkout/checkout-form.tsx`
- Create: `storefront/components/checkout/checkout-email.tsx`

**Step 1: Build the CheckoutForm accordion**

Replace the placeholder `storefront/components/checkout/checkout-form.tsx` with the full accordion stepper. This derives step completion from cart state and renders each step as an expandable/collapsible section.

Key implementation details:
- Derive `completedSteps` from cart fields: `cart.email`, `cart.shipping_address?.address_1`, `cart.shipping_methods?.length > 0`, `cart.payment_collection?.payment_sessions?.length > 0`
- `activeStep` starts as the first incomplete step
- Completed steps show a summary line and an "Edit" button
- Active step shows the form component
- Future steps are disabled
- Each step section: heading, summary (when collapsed), form content (when expanded), "Continue" button
- Use TailwindUI Multi-step accordion pattern: `divide-y divide-gray-200 border-b border-t border-gray-200`

The CheckoutForm renders steps in order: Email > Address > Shipping > Payment > Review. Each step component receives the cart, a callback to advance to the next step, and any step-specific props.

**Step 2: Build the CheckoutEmail component**

Create `storefront/components/checkout/checkout-email.tsx`:

- If `customer` is provided, pre-fill email and auto-submit via `setCartEmail()` on mount
- If guest, show email input with "Continue" button
- On submit: call `setCartEmail(cart.id, email)` — on success, call `onComplete()`
- Show loading state during submission

**Step 3: Verify email step works**

Run: `cd storefront && bun dev`
Navigate to: `/checkout`
Expected: Email step is expanded. Enter email, click Continue. Step collapses and shows the email as summary. Address step expands (but is placeholder).

**Step 4: Commit**

```bash
git add storefront/components/checkout/checkout-form.tsx storefront/components/checkout/checkout-email.tsx
git commit -m "feat(storefront): add checkout accordion stepper with email step

Cart-state-driven step derivation. Accordion UI with expand/collapse,
step summaries, and Edit buttons. Email step pre-fills for authenticated
customers and auto-advances.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Storefront — Address Step

**Files:**
- Create: `storefront/components/checkout/address-form.tsx`
- Create: `storefront/components/checkout/saved-address-picker.tsx`
- Create: `storefront/components/checkout/checkout-address.tsx`

**Step 1: Build the AddressForm component**

Create `storefront/components/checkout/address-form.tsx`:

Reusable address form with fields:
- `first_name`, `last_name` (side-by-side grid)
- `company` (optional)
- `address_1`
- `address_2` (optional)
- `city`, `province`, `postal_code` (3-column grid)
- `country_code` (dropdown — filter to countries in `cart.region.countries`)
- `phone`

Props:
- `defaultValues?: AddressPayload` — pre-fill from existing address
- `countries: { iso_2: string; display_name: string }[]` — from cart region
- `onChange?: (address: AddressPayload) => void`
- `ref` support for imperative `getValues()` or use controlled state

Use TailwindUI input styling: `block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6`

**Step 2: Build the SavedAddressPicker component**

Create `storefront/components/checkout/saved-address-picker.tsx`:

- Fetches customer addresses via `getCustomerAddresses()` on mount
- Renders as radio group (TailwindUI stacked cards pattern)
- Each option shows: name, address line, city/state/zip, phone
- Last option: "Use a different address" which triggers showing AddressForm
- Props: `onSelect: (address: AddressPayload) => void`

**Step 3: Build the CheckoutAddress component**

Create `storefront/components/checkout/checkout-address.tsx`:

- If customer exists: show `SavedAddressPicker`, with fallback to `AddressForm`
- If guest: show `AddressForm` directly
- "Billing address same as shipping" checkbox (default: checked)
- If unchecked, show second `AddressForm` for billing
- On "Continue": call `setCartAddresses(cart.id, shipping, billing)` — on success, call `onComplete()`

**Step 4: Wire into CheckoutForm**

Update `checkout-form.tsx` to render `CheckoutAddress` in the address step. Pass cart region countries for the country dropdown.

**Step 5: Verify address step works**

Run: `cd storefront && bun dev`
Navigate to: `/checkout`, complete email step
Expected: Address form appears. Fill in address, click Continue. Step collapses showing address summary.

**Step 6: Commit**

```bash
git add storefront/components/checkout/address-form.tsx storefront/components/checkout/saved-address-picker.tsx storefront/components/checkout/checkout-address.tsx storefront/components/checkout/checkout-form.tsx
git commit -m "feat(storefront): add checkout address step with saved addresses

AddressForm with country dropdown filtered to cart region. SavedAddressPicker
for authenticated customers. Billing address toggle (same as shipping default).
Guest flow shows form directly.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Storefront — Shipping Step

**Files:**
- Create: `storefront/components/checkout/checkout-shipping.tsx`
- Modify: `storefront/components/checkout/checkout-form.tsx`

**Step 1: Build CheckoutShipping component**

Create `storefront/components/checkout/checkout-shipping.tsx`:

- On mount, call `getShippingOptions(cart.id)` to fetch available options
- Show loading skeleton while fetching
- Render as TailwindUI "Stacked cards" radio group
- Each option shows: name, formatted price (use `Intl.NumberFormat`)
- For `price_type: "calculated"`, show the calculated amount
- On selection: call `setShippingMethod(cart.id, optionId)`
- On success, call `onComplete()`
- Show error message if `setShippingMethod` returns an error string

Radio card styling (from TailwindUI Stacked cards):
```
<label className="group relative block rounded-lg border border-gray-300 bg-white px-6 py-4 has-[:checked]:outline has-[:checked]:outline-2 has-[:checked]:-outline-offset-2 has-[:checked]:outline-indigo-600 sm:flex sm:justify-between">
  <input type="radio" ... className="absolute inset-0 appearance-none focus:outline focus:outline-0" />
  ...
</label>
```

**Step 2: Wire into CheckoutForm**

Update `checkout-form.tsx` to render `CheckoutShipping` in the shipping step.

**Step 3: Verify shipping step works**

Run: `cd storefront && bun dev`
Expected: After completing address, shipping options appear as radio cards. Selecting one advances to payment step.

Note: Requires at least one shipping option configured in Medusa Admin (Settings > Shipping > Fulfillment set). If none exist, the step will show "No shipping options available."

**Step 4: Commit**

```bash
git add storefront/components/checkout/checkout-shipping.tsx storefront/components/checkout/checkout-form.tsx
git commit -m "feat(storefront): add checkout shipping step with option selection

Fetches available shipping options for cart. TailwindUI stacked card radio
group. Handles flat and calculated price types. Auto-advances on selection.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Storefront — Payment Step (Stripe Payment Element)

**Files:**
- Create: `storefront/components/checkout/checkout-payment.tsx`
- Create: `storefront/components/checkout/saved-payment-methods.tsx`
- Modify: `storefront/components/checkout/checkout-form.tsx`

This is the most complex task. It integrates Stripe's Payment Element and saved payment methods.

**Step 1: Build CheckoutPayment component**

Create `storefront/components/checkout/checkout-payment.tsx`:

Key implementation:

```tsx
"use client";

import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
```

Flow:
1. On mount (when step becomes active), call `initializePaymentSession(cart.id, "pp_stripe_stripe", customer ? { setup_future_usage: "off_session" } : undefined)`
2. After revalidation, extract `clientSecret` from `cart.payment_collection?.payment_sessions?.[0]?.data?.client_secret`
3. If no `clientSecret` yet, show loading skeleton
4. When `clientSecret` is available, render `<Elements stripe={stripePromise} options={{ clientSecret }} key={clientSecret}>`
5. Inside Elements: render `SavedPaymentMethods` (if authenticated) and `PaymentElement`
6. `PaymentElement` with `options={{ layout: "accordion" }}`
7. Track completion via `onChange` — `event.complete` indicates form is valid
8. "Continue to review" button calls `elements.submit()` (validates/tokenizes, does NOT confirm)
9. On success, call `onComplete()` passing stripe/elements refs up for the review step

**Zero-total handling:**
- If `cart.total === 0`: skip Stripe, show "No payment required" message
- Initialize with `pp_system_default` instead
- `onComplete()` immediately (no stripe refs needed)

`stripePromise` should be created once at module level:
```ts
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY!);
```

**Step 2: Build SavedPaymentMethods component**

Create `storefront/components/checkout/saved-payment-methods.tsx`:

Following the official Medusa saved-payment-methods tutorial:
1. Extract `account_holder_id` from `paymentSession.context.account_holder.id`
2. Call `getSavedPaymentMethods(accountHolderId)` on mount
3. Render radio list: "Visa •••• 4242 — Expires 12/2026"
4. On selection: call `initializePaymentSession(cart.id, "pp_stripe_stripe", { payment_method: "pm_..." })`
5. Show "Use a new card" button that re-initializes without saved method
6. Track whether using saved or new via state

**Step 3: Wire into CheckoutForm**

Update `checkout-form.tsx`:
- Render `CheckoutPayment` in the payment step
- Store `stripe` and `elements` refs from payment step (needed for review step's confirmPayment call)
- These refs must be lifted to CheckoutForm state so CheckoutReview can access them

**Step 4: Verify payment step renders**

Run: `cd storefront && bun dev`
Expected: After completing shipping, payment step shows. Stripe Payment Element loads (requires valid `NEXT_PUBLIC_STRIPE_KEY`). Card form appears.

Note: Requires `NEXT_PUBLIC_STRIPE_KEY` env var set in storefront `.env.local` and Stripe enabled on the region in Medusa Admin.

**Step 5: Commit**

```bash
git add storefront/components/checkout/checkout-payment.tsx storefront/components/checkout/saved-payment-methods.tsx storefront/components/checkout/checkout-form.tsx
git commit -m "feat(storefront): add payment step with Stripe Payment Element

Stripe Payment Element integration with accordion layout. Saved payment
methods for authenticated customers (via official Medusa tutorial pattern).
Zero-total cart handling with pp_system_default. Elements.submit() validates
without confirming — confirmation happens in review step.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: Storefront — Review Step + Place Order

**Files:**
- Create: `storefront/components/checkout/checkout-review.tsx`
- Modify: `storefront/components/checkout/checkout-form.tsx`

**Step 1: Build CheckoutReview component**

Create `storefront/components/checkout/checkout-review.tsx`:

Summary sections with "Edit" links:
- Email
- Shipping address (formatted)
- Billing address (or "Same as shipping")
- Shipping method name + price
- Payment method (card brand + last 4, or saved card info)

"Place Order" button with loading state. On click:

```ts
// For new card payments:
const { error, paymentIntent } = await stripe.confirmPayment({
  elements,
  clientSecret,
  confirmParams: {
    return_url: `${window.location.origin}/checkout/capture/${cart.id}`,
    payment_method_data: {
      billing_details: {
        name: `${cart.billing_address?.first_name} ${cart.billing_address?.last_name}`,
        address: {
          city: cart.billing_address?.city ?? "",
          country: cart.billing_address?.country_code ?? "",
          line1: cart.billing_address?.address_1 ?? "",
          line2: cart.billing_address?.address_2 ?? "",
          postal_code: cart.billing_address?.postal_code ?? "",
          state: cart.billing_address?.province ?? "",
        },
        email: cart.email ?? "",
        phone: cart.billing_address?.phone ?? undefined,
      },
    },
  },
  redirect: "if_required",
});

// For saved payment methods:
const { error, paymentIntent } = await stripe.confirmCardPayment(
  clientSecret,
  { payment_method: session.data.payment_method as string }
);
```

Handle the response:
```ts
if (error) {
  const pi = error.payment_intent;
  if (pi && (pi.status === "requires_capture" || pi.status === "succeeded")) {
    // Stripe quirk: still complete even on "error"
    await handleOrderComplete();
    return;
  }
  setError(error.message || "Payment failed. Please try again.");
  return;
}

if (paymentIntent.status === "requires_capture" || paymentIntent.status === "succeeded") {
  await handleOrderComplete();
}
```

`handleOrderComplete`:
```ts
const result = await completeCart(cart.id);
if (result.type === "order") {
  router.push(`/order/confirmed/${result.order.id}`);
} else {
  setError(result.error);
}
```

For zero-total carts (no Stripe): directly call `completeCart()`.

**Step 2: Wire into CheckoutForm**

Update `checkout-form.tsx` to render `CheckoutReview` in the review step. Pass `stripe`, `elements`, `clientSecret`, and the `onEditStep` callback.

**Step 3: Verify the full flow**

Run: `cd storefront && bun dev`
Expected: Complete all steps through Review. "Place Order" confirms payment and redirects to order confirmation. Verify with Stripe test card `4242 4242 4242 4242`.

**Step 4: Commit**

```bash
git add storefront/components/checkout/checkout-review.tsx storefront/components/checkout/checkout-form.tsx
git commit -m "feat(storefront): add review step with Place Order and Stripe confirmation

Order review summary with Edit links. stripe.confirmPayment() with
redirect: 'if_required'. Handles card payments inline, redirect-based
payments via return_url. Saved payment method confirmation via
confirmCardPayment(). Zero-total carts skip Stripe entirely.
completeCart() cleans up cart cookie and revalidates.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: Storefront — Redirect Payment Callback

**Files:**
- Create: `storefront/app/checkout/capture/[cartId]/route.ts`

**Step 1: Build the redirect payment callback**

Create `storefront/app/checkout/capture/[cartId]/route.ts`:

This API route handles returns from redirect-based payments (PayPal, Klarna, iDEAL). After Stripe redirects the customer back, it validates the payment and completes the cart.

```ts
import { NextRequest, NextResponse } from "next/server";
import { completeCart, getCheckoutCart } from "lib/medusa/checkout";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cartId: string }> },
) {
  const { cartId } = await params;
  const { searchParams } = req.nextUrl;
  const paymentIntent = searchParams.get("payment_intent");
  const paymentIntentClientSecret = searchParams.get("payment_intent_client_secret");
  const redirectStatus = searchParams.get("redirect_status") || "";

  const origin = req.nextUrl.origin;

  // Validate required params
  if (!paymentIntent || !paymentIntentClientSecret) {
    return NextResponse.redirect(`${origin}/checkout?error=missing_payment_params`);
  }

  // Validate redirect status
  if (!["pending", "succeeded"].includes(redirectStatus)) {
    return NextResponse.redirect(`${origin}/checkout?error=payment_failed`);
  }

  // Complete the cart
  const result = await completeCart(cartId);

  if (result.type === "order") {
    return NextResponse.redirect(`${origin}/order/confirmed/${result.order.id}`);
  }

  return NextResponse.redirect(`${origin}/checkout?error=payment_failed`);
}
```

**Step 2: Commit**

```bash
git add storefront/app/checkout/capture/[cartId]/route.ts
git commit -m "feat(storefront): add redirect payment callback route

Handles return from redirect-based payments (PayPal, Klarna, iDEAL).
Validates payment_intent params and redirect_status, then completes
the cart and redirects to order confirmation.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13: Storefront — Order Confirmation Page

**Files:**
- Create: `storefront/app/order/confirmed/[orderId]/page.tsx`

**Step 1: Build the order confirmation page**

Create `storefront/app/order/confirmed/[orderId]/page.tsx`:

RSC page based on TailwindUI "Simple with full order details" component.

```tsx
import { sdk } from "lib/medusa";
import { getAuthHeaders } from "lib/medusa/cookies";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Order Confirmed",
};

async function getOrder(orderId: string) {
  const headers = await getAuthHeaders();
  try {
    const { order } = await sdk.client.fetch<{ order: any }>(
      `/store/orders/${orderId}`,
      {
        method: "GET",
        headers,
        query: {
          fields: "*items,*items.variant,*items.product,*shipping_address,*billing_address,*shipping_methods",
        },
      },
    );
    return order;
  } catch {
    return null;
  }
}

function formatMoney(amount: number | undefined, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
  }).format(amount ?? 0);
}

export default async function OrderConfirmedPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrder(orderId);

  if (!order) {
    redirect("/");
  }

  const currencyCode = order.currency_code || "USD";

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-xl">
          <h1 className="text-base font-medium text-indigo-600">Thank you!</h1>
          <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            Your order is confirmed
          </p>
          <p className="mt-2 text-base text-gray-500">
            Order #{order.display_id || order.id}
          </p>
        </div>

        <div className="mt-10 border-t border-gray-200">
          <h2 className="sr-only">Your order</h2>

          {/* Items */}
          <h3 className="sr-only">Items</h3>
          {(order.items || []).map((item: any) => (
            <div
              key={item.id}
              className="flex space-x-6 border-b border-gray-200 py-10"
            >
              <img
                alt={item.product?.title || item.title || ""}
                src={item.thumbnail || item.product?.thumbnail || ""}
                className="size-20 flex-none rounded-lg bg-gray-100 object-cover sm:size-40"
              />
              <div className="flex flex-auto flex-col">
                <div>
                  <h4 className="font-medium text-gray-900">
                    {item.product?.title || item.title}
                  </h4>
                  {item.variant?.title &&
                    item.variant.title !== "Default" && (
                      <p className="mt-2 text-sm text-gray-600">
                        {item.variant.title}
                      </p>
                    )}
                </div>
                <div className="mt-6 flex flex-1 items-end">
                  <dl className="flex divide-x divide-gray-200 text-sm">
                    <div className="flex pr-4 sm:pr-6">
                      <dt className="font-medium text-gray-900">Quantity</dt>
                      <dd className="ml-2 text-gray-700">{item.quantity}</dd>
                    </div>
                    <div className="flex pl-4 sm:pl-6">
                      <dt className="font-medium text-gray-900">Price</dt>
                      <dd className="ml-2 text-gray-700">
                        {formatMoney(item.total, currencyCode)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          ))}

          <div className="sm:ml-40 sm:pl-6">
            {/* Addresses */}
            <h3 className="sr-only">Your information</h3>
            <dl className="grid grid-cols-2 gap-x-6 py-10 text-sm">
              <div>
                <dt className="font-medium text-gray-900">Shipping address</dt>
                <dd className="mt-2 text-gray-700">
                  <address className="not-italic">
                    <span className="block">
                      {order.shipping_address?.first_name}{" "}
                      {order.shipping_address?.last_name}
                    </span>
                    <span className="block">
                      {order.shipping_address?.address_1}
                    </span>
                    <span className="block">
                      {order.shipping_address?.city},{" "}
                      {order.shipping_address?.province}{" "}
                      {order.shipping_address?.postal_code}
                    </span>
                  </address>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-900">Billing address</dt>
                <dd className="mt-2 text-gray-700">
                  <address className="not-italic">
                    <span className="block">
                      {order.billing_address?.first_name}{" "}
                      {order.billing_address?.last_name}
                    </span>
                    <span className="block">
                      {order.billing_address?.address_1}
                    </span>
                    <span className="block">
                      {order.billing_address?.city},{" "}
                      {order.billing_address?.province}{" "}
                      {order.billing_address?.postal_code}
                    </span>
                  </address>
                </dd>
              </div>
            </dl>

            {/* Shipping method */}
            <dl className="grid grid-cols-2 gap-x-6 border-t border-gray-200 py-10 text-sm">
              <div>
                <dt className="font-medium text-gray-900">Shipping method</dt>
                <dd className="mt-2 text-gray-700">
                  {order.shipping_methods?.[0]?.name || "Standard"}
                </dd>
              </div>
            </dl>

            {/* Summary */}
            <h3 className="sr-only">Summary</h3>
            <dl className="space-y-6 border-t border-gray-200 pt-10 text-sm">
              <div className="flex justify-between">
                <dt className="font-medium text-gray-900">Subtotal</dt>
                <dd className="text-gray-700">
                  {formatMoney(order.subtotal, currencyCode)}
                </dd>
              </div>
              {(order.shipping_total ?? 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="font-medium text-gray-900">Shipping</dt>
                  <dd className="text-gray-700">
                    {formatMoney(order.shipping_total, currencyCode)}
                  </dd>
                </div>
              )}
              {(order.tax_total ?? 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="font-medium text-gray-900">Taxes</dt>
                  <dd className="text-gray-700">
                    {formatMoney(order.tax_total, currencyCode)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="font-medium text-gray-900">Total</dt>
                <dd className="text-gray-900">
                  {formatMoney(order.total, currencyCode)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-16 border-t border-gray-200 pt-6">
          <Link
            href="/"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Continue Shopping
            <span aria-hidden="true"> &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify**

Run: `cd storefront && bun run typecheck`
Expected: No type errors.

**Step 3: Commit**

```bash
git add storefront/app/order/confirmed/[orderId]/page.tsx
git commit -m "feat(storefront): add order confirmation page

RSC page based on TailwindUI 'Simple with full order details'. Shows
order items, addresses, shipping method, and cost breakdown with
Continue Shopping CTA.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 14: Integration Verification

**Step 1: Full typecheck**

Run: `cd storefront && bun run typecheck`
Expected: No type errors across all new files.

**Step 2: Build check**

Run: `cd storefront && bun run build`
Expected: Build succeeds.

**Step 3: Manual E2E test**

Prerequisites:
- Backend running (`cd backend && bun run dev`)
- Stripe API key set in backend `.env` (`STRIPE_API_KEY=sk_test_...`)
- Stripe publishable key set in storefront `.env.local` (`NEXT_PUBLIC_STRIPE_KEY=pk_test_...`)
- Stripe enabled on region in Medusa Admin
- At least one shipping option configured

Test flow:
1. Add item to cart
2. Navigate to `/checkout`
3. Enter email → Continue
4. Enter shipping address → Continue
5. Select shipping option → auto-advances
6. Stripe Payment Element loads → enter test card `4242 4242 4242 4242`, exp `12/34`, CVC `123`
7. Continue to review
8. Click "Place Order"
9. Verify redirect to `/order/confirmed/[orderId]`
10. Verify order appears in Medusa Admin
11. Verify cart is cleared (nav count = 0)

Test card numbers:
- `4242 4242 4242 4242` — succeeds
- `4000 0000 0000 3220` — triggers 3D Secure
- `4000 0000 0000 0002` — always declines

**Step 4: Final commit (if any fixes needed)**

---

## Summary of Commits

| # | Message | Files |
|---|---------|-------|
| 1 | `feat(backend): add Stripe payment module provider` | `medusa-config.ts` |
| 2 | `feat(backend): add saved payment methods API route` | `route.ts`, `middlewares.ts` |
| 3 | `chore(storefront): add Stripe.js packages` | `package.json`, `bun.lock` |
| 4 | `feat(storefront): add checkout type definitions` | `types.ts` |
| 5 | `feat(storefront): add checkout server actions` | `checkout.ts`, `actions.ts` |
| 6 | `feat(storefront): add checkout page shell` | `page.tsx`, `order-summary.tsx`, `checkout-form.tsx` |
| 7 | `feat(storefront): add accordion stepper + email step` | `checkout-form.tsx`, `checkout-email.tsx` |
| 8 | `feat(storefront): add address step` | `address-form.tsx`, `saved-address-picker.tsx`, `checkout-address.tsx` |
| 9 | `feat(storefront): add shipping step` | `checkout-shipping.tsx` |
| 10 | `feat(storefront): add payment step` | `checkout-payment.tsx`, `saved-payment-methods.tsx` |
| 11 | `feat(storefront): add review step + Place Order` | `checkout-review.tsx` |
| 12 | `feat(storefront): add redirect payment callback` | `capture/[cartId]/route.ts` |
| 13 | `feat(storefront): add order confirmation page` | `order/confirmed/[orderId]/page.tsx` |
