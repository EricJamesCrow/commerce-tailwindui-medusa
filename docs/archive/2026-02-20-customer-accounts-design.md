# Customer Accounts Design

## Overview

Full customer authentication and account management for the commerce-tailwindui-medusa storefront. Adds signup, login, signout, profile management, order history, address CRUD, and auth-aware navigation.

## Architecture

**Server-first with Server Actions.** Matches the existing cart pattern: Server Actions for mutations, server components for data fetching, `useActionState` for form error display. No client-side auth context.

- Auth state lives in a secure httpOnly cookie (`_medusa_jwt`), managed by `lib/medusa/cookies.ts` (already built)
- All cart operations already pass auth headers (already built)
- Route protection: call `retrieveCustomer()` in server components, redirect if `null`
- Cache: `retrieveCustomer()` uses `"use cache"` with a `customers` tag. Mutations revalidate this tag.

## TailwindUI Components

All UI sourced from `tailwindplus-components.json` (657 components). Prioritize ecommerce section; fall back to application-ui when no ecommerce equivalent exists.

| Page/Component         | TailwindUI Source                                 |
| ---------------------- | ------------------------------------------------- |
| Login / Register pages | **Sign-in and Registration > Split screen**       |
| Profile edit form      | **Form Layouts > Labels on left**                 |
| Address edit form      | **Form Layouts > Stacked**                        |
| Order history          | **Order History > Invoice panels**                |
| Account dropdown (nav) | **Dropdowns > With icons**                        |
| User avatar (nav)      | **Avatars > Circular with placeholder initials**  |
| Form inputs            | **Input Groups** (various, already extracted)     |
| Buttons                | **Buttons > Primary buttons** (already extracted) |
| Status badges (orders) | **Badges** (already extracted)                    |

## Data Layer

### File: `lib/medusa/customer.ts`

`"use server"` directive. All functions are Server Actions.

```ts
retrieveCustomer()          → StoreCustomer | null
signup(state, formData)     → Server Action (useActionState)
login(state, formData)      → Server Action (useActionState)
signout()                   → Server Action
transferCart()              → internal helper
updateCustomer(state, fd)   → Server Action (useActionState)
addCustomerAddress(state, fd)      → Server Action
updateCustomerAddress(state, fd)   → Server Action
deleteCustomerAddress(addressId)   → Server Action
```

### Auth Flows

**Signup:** `sdk.auth.register` > `setAuthToken` > `sdk.store.customer.create` > `sdk.auth.login` > `setAuthToken` > `transferCart()` > redirect `/account`

**Login:** `sdk.auth.login` > `setAuthToken` > `transferCart()` > redirect `/account`

**Signout:** `sdk.auth.logout` > `removeAuthToken` > `removeCartId` > revalidate `customers` + `cart` tags > redirect `/`

**Cart transfer:** On login/signup, associates the anonymous cart with the customer via `sdk.store.cart.transferCart`. Ensures items added before login are preserved.

### Error Handling

Same pattern as cart: `medusaError()` for SDK errors, Server Actions return error strings for `useActionState` display. Revalidation in `finally` blocks to re-sync optimistic state on failure.

### Caching

`retrieveCustomer()` uses `"use cache"` with `cacheTag("customers")` and `cacheLife("days")`. Multiple pages calling `retrieveCustomer()` in the same request are deduplicated by Next.js. All mutations revalidate the `customers` tag.

## Route Structure

```text
app/
├── (auth)/account/                 # Unguarded route group
│   ├── login/page.tsx              # Login (split-screen)
│   └── register/page.tsx           # Register (split-screen)
├── account/                        # Guarded by layout auth check
│   ├── layout.tsx                  # Auth guard + top tab navigation
│   ├── page.tsx                    # Profile (default tab)
│   ├── orders/page.tsx             # Order history
│   └── addresses/page.tsx          # Address management
```

**Why route groups:** The `(auth)` group prevents login/register from inheriting the `account/layout.tsx` auth guard, which would cause an infinite redirect loop (unauthenticated user hits guard > redirect to login > login inherits same guard > redirect to login > ...).

**Redirect logic:**

- `(auth)/account/login` and `register`: Call `retrieveCustomer()`. If logged in, redirect to `/account`.
- `account/layout.tsx`: Call `retrieveCustomer()`. If `null`, redirect to `/(auth)/account/login`.

## Page Designs

### Login Page (`(auth)/account/login/page.tsx`)

Split-screen layout. Form on left, hero image on right (hidden on mobile).

- Fields: Email, Password
- Links: "Forgot password?" (stub), "Don't have an account? Create one" > `/account/register`
- `LoginForm` client component uses `useActionState` with `login` Server Action
- Submit button shows pending state
- Inline error display on failure

### Register Page (`(auth)/account/register/page.tsx`)

Same split-screen layout.

- Fields: First name, Last name, Email, Phone (optional, `type="tel"`), Password
- Phone: raw text input, no format validation (Medusa stores `string | null`, no server-side format enforcement)
- Links: "Already have an account? Sign in" > `/account/login`
- `RegisterForm` client component uses `useActionState` with `signup` Server Action

### Account Layout (`account/layout.tsx`)

- Server component
- Calls `retrieveCustomer()` — redirects to login if `null`
- Renders top tab navigation: Profile (`/account`), Orders (`/account/orders`), Addresses (`/account/addresses`)
- Tab bar uses `<Link>` elements; active state based on current pathname
- Children call `retrieveCustomer()` independently (cache-deduplicated)

### Profile Page (`account/page.tsx`)

- TailwindUI "Labels on left" form layout
- Always-editable form (no toggle between view/edit modes)
- Fields: First name, Last name, Email (read-only), Phone
- `ProfileForm` client component with `useActionState` calling `updateCustomer`
- Save button with pending state

### Orders Page (`account/orders/page.tsx`)

- Server component fetching `sdk.store.order.list` with auth headers
- TailwindUI "Invoice panels" layout — grid of order cards
- Each card: order number, date, total, status (badge), line item thumbnails
- Empty state: centered text when no orders
- No individual order detail page (deferred)

### Addresses Page (`account/addresses/page.tsx`)

- Grid of address cards with Edit/Delete actions
- "Add new address" button
- `AddressForm` client component using TailwindUI "Stacked" form layout
- Fields: first name, last name, company, address 1, address 2, city, province, postal code, country (select), phone
- Edit: same form pre-filled
- Delete: calls `deleteCustomerAddress` with confirmation dialog

## Navigation Changes

### Navbar (`components/layout/navbar/`)

**`navbar-data.tsx`:** Add `retrieveCustomer()` call. Pass `customer` prop to `NavbarClient`.

**`navbar-client.tsx`:** Accept `customer: StoreCustomer | null` prop.

- Logged out: "Sign in" link > `/account/login`
- Logged in: User initials avatar > dropdown menu

### Account Dropdown (`components/account/account-dropdown.tsx`)

Client component using Headless UI `Menu`.

| Item          | Icon                             | Action                                 |
| ------------- | -------------------------------- | -------------------------------------- |
| My Account    | `UserIcon`                       | Link to `/account`                     |
| Order History | `ClipboardDocumentListIcon`      | Link to `/account/orders`              |
| Sign out      | `ArrowRightStartOnRectangleIcon` | `signout()` Server Action via `<form>` |

### Mobile Menu

Add conditional auth section to mobile slide-out:

- Logged out: "Sign in" and "Create account" links
- Logged in: Account, Orders, Sign out links

## Component Structure

```text
components/account/
├── login-form.tsx              # useActionState + login Server Action
├── register-form.tsx           # useActionState + signup Server Action
├── profile-form.tsx            # useActionState + updateCustomer Server Action
├── address-form.tsx            # Add/edit address form
├── address-card.tsx            # Individual address display
├── order-card.tsx              # Individual order panel
├── account-tabs.tsx            # Top tab navigation (client, for active state)
├── account-dropdown.tsx        # Navbar dropdown menu (client, Headless UI Menu)
```

## Implementation Phases

### Phase 1: Auth data layer

- Create `lib/medusa/customer.ts` with all Server Actions
- Add `customers` cache tag to `lib/constants.ts`
- Add `getOrders()` function to `lib/medusa/index.ts`

### Phase 2: Auth UI (login/register)

- Create `(auth)` route group with login and register pages
- Build `LoginForm` and `RegisterForm` client components
- Extract split-screen layout from `tailwindplus-components.json`

### Phase 3: Account pages

- Create guarded `account/layout.tsx` with top tabs
- Build profile page with `ProfileForm`
- Build orders page with `OrderCard` (invoice panels)
- Build addresses page with `AddressForm` and `AddressCard`

### Phase 4: Auth-aware navigation

- Update `navbar-data.tsx` to fetch customer
- Update `navbar-client.tsx` with conditional auth display
- Build `AccountDropdown` component
- Update mobile menu with auth links

## Test Cases

- Signup flow: register > auto-login > cart transferred > redirected to /account
- Login flow: login > cart transferred > redirected to /account
- Signout flow: sign out > cookies cleared > caches invalidated > redirected to /
- Back button after signout: cache invalidated by signout, no stale customer data
- Auth guard: unauthenticated user visiting /account/\* redirected to login
- Inverse guard: authenticated user visiting /account/login redirected to /account
- Profile update: form submission > customer data updated > cache revalidated
- Address CRUD: add, edit, delete addresses with inline error display
- Cart transfer: items added anonymously preserved after login
- Navbar: reflects auth state immediately after login/signout
- Mobile menu: shows correct links based on auth state

## Deferred

- Forgot password / password reset flow
- Individual order detail page
- Social login providers
- Email verification
