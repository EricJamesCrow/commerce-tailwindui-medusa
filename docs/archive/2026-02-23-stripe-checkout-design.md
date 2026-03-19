# Stripe Checkout Flow — Design Document

**Date:** 2026-02-23
**Branch:** `feat-stripe-checkout`
**Status:** Approved

## Overview

Full checkout flow with Stripe payment for the commerce storefront. Implements the Medusa v2 checkout API (7-step flow) with Stripe Payment Element, saved payment methods for authenticated customers, guest checkout, redirect-based payment support, and order confirmation.

### References

- [Medusa Checkout Overview](https://docs.medusajs.com/resources/storefront-development/checkout)
- [Medusa Checkout: Address](https://docs.medusajs.com/resources/storefront-development/checkout/address)
- [Medusa Checkout: Shipping](https://docs.medusajs.com/resources/storefront-development/checkout/shipping)
- [Medusa Checkout: Payment](https://docs.medusajs.com/resources/storefront-development/checkout/payment)
- [Medusa Checkout: Complete Cart](https://docs.medusajs.com/resources/storefront-development/checkout/complete-cart)
- [Medusa Stripe Integration](https://docs.medusajs.com/resources/storefront-development/checkout/payment/stripe)
- [Stripe Payment Element Customization](https://docs.medusajs.com/resources/nextjs-starter/guides/customize-stripe)
- [Stripe Module Provider Config](https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider/stripe)
- [Saved Payment Methods Tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/saved-payment-methods)
- [lambda-curry/medusa2-starter](https://github.com/lambda-curry/medusa2-starter) (Remix reference — adapt to Next.js)

---

## Architecture

### State Management: Cart-State-Driven Steps

The cart is the source of truth for which checkout steps are complete. On page load, inspect the cart to derive the furthest completed step:

| Cart field | Step completed |
|-----------|----------------|
| `cart.email` | Email |
| `cart.shipping_address?.address_1` | Address |
| `cart.shipping_methods?.length > 0` | Shipping |
| `cart.payment_collection?.payment_sessions?.length > 0` | Payment initialized |

Accordion expansion is managed client-side. On refresh/navigation, the page rebuilds to the correct step from cart state. No URL params needed.

### Page Structure

```
/checkout                              → Checkout page (RSC shell + client CheckoutForm)
/checkout/capture/[cartId]/route.ts    → API route for redirect-based payment callbacks
/order/confirmed/[orderId]             → Order confirmation page (RSC)
```

### Component Tree

```
app/(store)/checkout/page.tsx              ← RSC: fetches cart + customer, cart guard
  ├─ OrderSummary                          ← Sidebar: items, subtotals, total
  └─ CheckoutForm (client)                ← 'use client': accordion stepper
       ├─ [Future: ExpressCheckout]        ← Apple Pay / Google Pay (deferred)
       ├─ CheckoutEmail                    ← Email input
       ├─ CheckoutAddress                  ← Shipping + billing
       │    ├─ SavedAddressPicker          ← For authenticated customers
       │    └─ AddressForm                 ← Reusable address field group
       ├─ CheckoutShipping                 ← Shipping option selection
       ├─ CheckoutPayment                  ← Stripe Payment Element + saved cards
       │    ├─ StripePaymentWrapper        ← <Elements> provider
       │    ├─ SavedPaymentMethods         ← Radio list of saved cards
       │    └─ PaymentElement              ← Stripe <PaymentElement>
       └─ CheckoutReview                   ← Summary + "Place Order" button
```

### Data Flow

```
1. RSC page.tsx:
   - getCart() via Medusa SDK (raw HttpTypes.StoreCart, not transformed)
   - retrieveCustomer() → null for guests
   - Guard: redirect to "/" if cart is null/empty
   - Pass { cart, customer } to CheckoutForm

2. CheckoutForm (client):
   - Derive completed steps from cart state
   - Each step calls a server action → revalidates TAGS.cart → RSC re-renders → new props

3. Stripe Elements:
   - Mounted only when payment session exists (has client_secret)
   - PaymentElement for card input
   - On "Place Order": elements.submit() → stripe.confirmPayment() → completeCart()
```

### File Organization

```
storefront/
├─ app/(store)/checkout/
│   ├─ page.tsx                        # RSC: cart guard, data fetch, layout
│   └─ capture/[cartId]/
│       └─ route.ts                    # API route: redirect payment callback
├─ app/(store)/order/confirmed/[orderId]/
│   └─ page.tsx                        # Order confirmation RSC
├─ components/checkout/
│   ├─ checkout-form.tsx               # Main client component (accordion)
│   ├─ checkout-email.tsx              # Email step
│   ├─ checkout-address.tsx            # Address step
│   ├─ checkout-shipping.tsx           # Shipping step
│   ├─ checkout-payment.tsx            # Payment step (Stripe wrapper)
│   ├─ checkout-review.tsx             # Review + Place Order
│   ├─ order-summary.tsx               # Sidebar summary
│   ├─ address-form.tsx                # Reusable address fields
│   ├─ saved-address-picker.tsx        # Saved address selector
│   └─ saved-payment-methods.tsx       # Saved card selector
├─ lib/medusa/
│   └─ checkout.ts                     # All checkout server actions
```

---

## Backend Configuration

### Stripe Module Provider (`backend/medusa-config.ts`)

Add to the existing `modules` array:

```ts
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
          capture: false,                    // manual capture (capture on fulfillment)
          automatic_payment_methods: true,    // enables Payment Element to show all methods
        },
      },
    ],
  },
},
```

**Key decisions:**

- `capture: false` — manual capture is the ecommerce standard. Payment is authorized at checkout, captured when fulfilled via Admin.
- `automatic_payment_methods: true` — enables the Payment Element to show all available methods (cards, wallets, BNPL). Future-proofs for Express Checkout.
- Medusa auto-registers webhook handling at `/hooks/payment/stripe_stripe`.

### Stripe Webhook Configuration

**Endpoint URL:** `{BACKEND_URL}/hooks/payment/stripe_stripe`

**Required events (configure in Stripe Dashboard):**
- `payment_intent.amount_capturable_updated`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

### Saved Payment Methods API Route

**File:** `backend/src/api/store/payment-methods/[account_holder_id]/route.ts`

Following the [official Medusa tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/saved-payment-methods):

```ts
import { MedusaError } from "@medusajs/framework/utils"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { account_holder_id } = req.params
  const query = req.scope.resolve("query")
  const paymentModuleService = req.scope.resolve("payment")

  const { data: [accountHolder] } = await query.graph({
    entity: "account_holder",
    fields: ["data", "provider_id"],
    filters: { id: account_holder_id },
  })

  if (!accountHolder) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Account holder not found")
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

**Middleware** (`backend/src/api/middlewares.ts`):

```ts
{
  matcher: "/store/payment-methods/:account_holder_id",
  method: "GET",
  middlewares: [authenticate("customer", ["bearer", "session"])],
}
```

### Environment Variables

**Backend (`.env`):**
```
STRIPE_API_KEY=sk_test_...           # Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...      # Stripe webhook signing secret
```

**Storefront (`.env.local`):**
```
NEXT_PUBLIC_STRIPE_KEY=pk_test_...   # Stripe publishable key
```

### Admin Setup

After deploying, enable Stripe as a payment provider on the target region:
Admin → Settings → Regions → Edit → Payment Providers → select "Stripe"

---

## Data Layer (Server Actions + Types)

### Server Actions (`storefront/lib/medusa/checkout.ts`)

All checkout server actions follow established patterns:
- `"use server"` directive
- `try/catch/finally` with `finally` calling `revalidateCart()`
- Errors returned as strings (for `useActionState`)
- Auth headers via `getAuthHeaders()`
- SDK errors normalized via `.catch(medusaError)`

```ts
"use server"

// === Revalidation ===
function revalidateCheckout(): void {
  revalidateTag(TAGS.cart, "max")
  revalidatePath("/", "layout")
}

// === Cart Email ===
async function setCartEmail(cartId: string, email: string)
  // sdk.store.cart.update(cartId, { email }, {}, headers)

// === Addresses ===
async function setCartAddresses(
  cartId: string,
  shipping: AddressPayload,
  billing?: AddressPayload  // undefined = same as shipping
)
  // sdk.store.cart.update(cartId, { shipping_address, billing_address }, {}, headers)

// === Shipping ===
async function getShippingOptions(cartId: string): Promise<ShippingOption[]>
  // sdk.store.fulfillment.listCartOptions({ cart_id: cartId })
  // For price_type === "calculated": sdk.store.fulfillment.calculate(optionId, { cart_id })

async function setShippingMethod(cartId: string, optionId: string)
  // sdk.store.cart.addShippingMethod(cartId, { option_id: optionId }, {}, headers)

// === Payment ===
async function getPaymentProviders(regionId: string)
  // sdk.store.payment.listPaymentProviders({ region_id: regionId })

async function initializePaymentSession(
  cart: HttpTypes.StoreCart,
  providerId: string,
  data?: Record<string, unknown>
)
  // sdk.store.payment.initiatePaymentSession(cart, { provider_id: providerId, data }, {}, headers)
  // data may include:
  //   { setup_future_usage: "off_session" }  — to save card for future use
  //   { payment_method: "pm_..." }            — to use a saved card

// === Saved Payment Methods ===
async function getSavedPaymentMethods(accountHolderId: string)
  // sdk.client.fetch<{ payment_methods: SavedPaymentMethod[] }>(
  //   `/store/payment-methods/${accountHolderId}`, { method: "GET", headers }
  // ).catch(() => ({ payment_methods: [] }))

// === Complete Cart ===
async function completeCart(cartId: string): Promise<CartCompletionResult>
  // sdk.store.cart.complete(cartId, {}, headers)
  // On success (type === "order"):
  //   - removeCartId()           ← clears _medusa_cart_id cookie
  //   - revalidateTag(TAGS.cart) ← nav cart count resets to 0
  //   - revalidatePath("/", "layout")
  //   - return { type: "order", order }
  // On failure (type === "cart"):
  //   - return { type: "cart", error }

// === Customer Addresses ===
async function getCustomerAddresses(): Promise<HttpTypes.StoreCustomerAddress[]>
  // sdk.store.customer.listAddress({}, headers)
```

### Types (add to `storefront/lib/types.ts`)

```ts
type CheckoutStep = "email" | "address" | "shipping" | "payment" | "review"

type AddressPayload = {
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

type ShippingOption = {
  id: string
  name: string
  price_type: "flat" | "calculated"
  amount: number
  currency_code: string
}

type SavedPaymentMethod = {
  id: string           // pm_...
  provider_id: string
  data: {
    card: {
      brand: string    // "visa", "mastercard", etc.
      last4: string
      exp_month: number
      exp_year: number
    }
  }
}

type CartCompletionResult =
  | { type: "order"; order: HttpTypes.StoreOrder }
  | { type: "cart"; error: string }
```

---

## Checkout UI Components

### TailwindUI Base

Using the **"Multi-step"** checkout form component as the foundation:
- Two-column layout (`lg:grid-cols-2`)
- Left: accordion step panels
- Right: order summary sidebar
- Express Checkout placeholder at top (deferred)

### Checkout Page RSC (`app/(store)/checkout/page.tsx`)

```
Server Component:
1. getCart() — raw HttpTypes.StoreCart (not the transformed Cart type)
   - If null or no items → redirect("/")
2. retrieveCustomer() — null for guests
3. Render two-column layout:
   - Left column: <CheckoutForm cart={cart} customer={customer} />
   - Right column: <OrderSummary cart={cart} />
```

### CheckoutForm (`components/checkout/checkout-form.tsx`)

```
'use client'

Props: { cart: HttpTypes.StoreCart, customer: HttpTypes.StoreCustomer | null }

State:
  - activeStep: CheckoutStep
  - completedSteps: Set<CheckoutStep>
  - Both derived from cart props on mount and on prop changes

Accordion behavior:
  - Completed steps: collapsed, show summary text, clickable to re-expand
  - Active step: expanded with form
  - Future steps: collapsed, disabled
  - "Continue" button per step: validates → calls server action → on success, advances

Step summaries (shown when collapsed + completed):
  - Email: "john@example.com"
  - Address: "123 Main St, City, ST 12345"
  - Shipping: "Standard Shipping — $5.00"
  - Payment: "Visa •••• 4242"
```

### CheckoutEmail (`components/checkout/checkout-email.tsx`)

- **Authenticated:** Pre-filled with `customer.email`, auto-advances (still calls `setCartEmail()`)
- **Guest:** Email input field + "Continue" button
- Server action: `setCartEmail(cartId, email)`

### CheckoutAddress (`components/checkout/checkout-address.tsx`)

**Authenticated flow:**
- `SavedAddressPicker`: radio list of customer's saved addresses via `getCustomerAddresses()`
- "Use a different address" option reveals `AddressForm`

**Guest flow:**
- `AddressForm` directly

**Billing address:**
- "Same as shipping" checkbox (default: checked)
- Unchecking reveals a second `AddressForm` for billing

**Server action:** `setCartAddresses(cartId, shipping, billing)`

### AddressForm (`components/checkout/address-form.tsx`) — Reusable

TailwindUI form layout with fields:
- first_name, last_name (side-by-side)
- company (optional)
- address_1, address_2
- city, country_code (dropdown), province, postal_code (grid)
- phone

Country dropdown filtered to countries in the cart's region. Validation error styling from TailwindUI "Input with validation error" pattern.

### CheckoutShipping (`components/checkout/checkout-shipping.tsx`)

- Fetches `getShippingOptions(cartId)` on mount
- TailwindUI **"Stacked cards"** radio group
- Each option: name, description/estimated time, formatted price
- For `price_type: "calculated"`: calls `calculate()` to get actual price
- On selection: `setShippingMethod(cartId, optionId)` → auto-advances

### CheckoutPayment (`components/checkout/checkout-payment.tsx`)

**Payment session initialization (on mount):**
```
initializePaymentSession(cart, {
  provider_id: "pp_stripe_stripe",
  data: customer ? { setup_future_usage: "off_session" } : undefined
})
```

Only passes `setup_future_usage` for authenticated customers (to save card for future use).

**StripePaymentWrapper:**
```tsx
<Elements
  stripe={stripePromise}
  options={{ clientSecret }}
  key={clientSecret}         // Forces remount on new payment intent
>
  {children}
</Elements>
```

`stripePromise` = `loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY)`
`clientSecret` = `cart.payment_collection?.payment_sessions?.[0]?.data?.client_secret`

**Saved payment methods (authenticated only):**
- Extract `account_holder_id` from `paymentSession.context.account_holder.id`
- Fetch via `getSavedPaymentMethods(accountHolderId)`
- Render as radio list: "Visa •••• 4242 — Expires 12/2026"
- Selecting calls `initializePaymentSession(cart, { provider_id, data: { payment_method: "pm_..." } })`
- "Use a new card" button re-initializes session without saved method

**Payment Element (new card):**
```tsx
<PaymentElement
  options={{ layout: "accordion" }}
  onChange={(event) => {
    setSelectedPaymentMethod(event.value.type)  // "card", "paypal", etc.
    setStripeComplete(event.complete)
  }}
/>
```

**Step completion:** `elements.submit()` — validates/tokenizes but does NOT confirm payment yet. Advances to Review step.

### CheckoutReview (`components/checkout/checkout-review.tsx`)

Summary of all steps with "Edit" links:
- Email, shipping address, billing address, shipping method, payment method

**"Place Order" button flow:**

```
1. stripe.confirmPayment({
     elements,
     clientSecret,
     confirmParams: {
       return_url: `${window.location.origin}/checkout/capture/${cartId}`,
       payment_method_data: {
         billing_details: {
           name: billing.first_name + " " + billing.last_name,
           address: { line1, line2, city, country, postal_code, state },
           email: cart.email,
           phone: billing.phone,
         }
       }
     },
     redirect: "if_required"    // Cards stay on page; PayPal/Klarna redirect
   })

2. Handle response:
   - paymentIntent.status === "requires_capture" || "succeeded"
     → completeCart(cartId)
     → redirect to /order/confirmed/[orderId]

   - error BUT paymentIntent still succeeded/requires_capture
     → still complete (Stripe quirk per Medusa docs)

   - Genuine error (card declined, insufficient funds, etc.)
     → Show user-friendly error message, allow retry

3. For saved payment methods:
   - stripe.confirmCardPayment(clientSecret, {
       payment_method: session.data.payment_method  // "pm_..." string
     })
```

**IMPORTANT:** `return_url` is always built from `window.location.origin` (absolute URL), never hardcoded or relative.

### Redirect Payment Callback (`app/(store)/checkout/capture/[cartId]/route.ts`)

API route handling return from redirect-based payments (PayPal, Klarna, iDEAL):

```
GET /checkout/capture/[cartId]?payment_intent=...&payment_intent_client_secret=...&redirect_status=...

1. Retrieve cart via SDK
2. Find matching payment session by payment_intent ID
3. Validate:
   - client_secret matches payment_intent_client_secret
   - redirect_status is "pending" or "succeeded"
   - session.status is "pending" or "authorized"
4. Valid → completeCart(cartId) → redirect to /order/confirmed/[orderId]
5. Invalid → redirect to /checkout?error=payment_failed
```

### OrderSummary (`components/checkout/order-summary.tsx`)

Sidebar (right column) showing:
- Product images, names, variants, quantities, prices
- Subtotal, shipping estimate, tax, discount (if any), total
- Updates on each step via revalidation

### Order Confirmation (`app/(store)/order/confirmed/[orderId]/page.tsx`)

RSC page using TailwindUI **"Simple with full order details"**:

- "Thank you!" heading + order number
- Product list: images, names, quantities, prices
- Shipping address and billing address (`<address>` elements)
- Payment method: card brand + last 4 digits
- Shipping method name
- Cost breakdown: subtotal, discount, shipping, tax, total
- "Continue Shopping" CTA → link to `/`

### Zero-Total Cart Handling

If `cart.total === 0` (full discount, gift card covers total):
- Skip Stripe entirely
- Initialize payment session with `pp_system_default` (Medusa's manual provider)
- Payment step shows "No payment required" message
- "Place Order" directly calls `completeCart()` — no Stripe confirmation needed

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Card declined | Show Stripe error message, allow retry |
| Card expired | Show "Card expired" message |
| Insufficient funds | Show "Insufficient funds" message |
| 3D Secure required | `stripe.confirmPayment()` handles automatically |
| 3D Secure failed | Show error, allow retry with different card |
| Network failure | "Connection lost. Please try again." + retry button |
| Payment session init failure | Retry with exponential backoff (max 3 attempts) |
| Cart already completed | Redirect to order confirmation |
| Cart empty | Redirect to `/` |
| Invalid address (country not in region) | Form validation prevents submission |
| Redirect payment failed | `/checkout/capture` route redirects back with error param |

---

## Cart Guards

| Condition | Action |
|-----------|--------|
| No cart / empty cart | Redirect to `/` |
| Cart has no items | Redirect to `/` |
| Cart already completed (edge case) | Redirect to order confirmation if order exists |

---

## Deferred: Express Checkout (Apple Pay / Google Pay / Link)

**Designed but not implemented in this PR.** Architecture supports it:

- Separate `<ExpressCheckoutElement>` at top of checkout page with "or" divider
- Requires its own `<Elements>` provider with `mode: "payment"` (no `clientSecret`)
- `onClick` → configure required info (email, shipping, billing, phone)
- `onShippingAddressChange` → update cart address, re-fetch shipping options
- `onShippingRateChange` → set shipping method, update total
- `onConfirm` → confirm payment → complete cart
- Needs Apple Pay domain verification file at `/.well-known/apple-developer-merchantid-domain-association`
- `automatic_payment_methods: true` is already configured in Stripe module (future-proofed)

---

## Packages to Install

**Storefront:**
```
bun add @stripe/stripe-js @stripe/react-stripe-js
```

**Backend:**
No additional packages — `@medusajs/medusa/payment-stripe` is built into `@medusajs/medusa`.

---

## Medusa SDK Call Sequence (Complete Checkout)

```
1. Cart exists with items (already built)
   ↓
2. sdk.store.cart.update(cartId, { email })
   ↓
3. sdk.store.cart.update(cartId, { shipping_address, billing_address })
   ↓
4. sdk.store.fulfillment.listCartOptions({ cart_id })
   ↓ (optional: sdk.store.fulfillment.calculate() for calculated prices)
   ↓
5. sdk.store.cart.addShippingMethod(cartId, { option_id })
   ↓
6. sdk.store.payment.initiatePaymentSession(cart, {
     provider_id: "pp_stripe_stripe",
     data: { setup_future_usage: "off_session" }  // if authenticated
   })
   ↓ (re-fetch cart → get client_secret)
   ↓
7. stripe.confirmPayment({ elements, clientSecret, ... })
   ↓
8. sdk.store.cart.complete(cartId)
   ↓
9. type === "order" → removeCartId() + revalidate → redirect to confirmation
```
