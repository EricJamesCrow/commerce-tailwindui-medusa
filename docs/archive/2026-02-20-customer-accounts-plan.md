# Customer Accounts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full customer authentication and account management (signup, login, signout, profile, orders, addresses, auth-aware nav) to the commerce-tailwindui-medusa storefront.

**Architecture:** Server-first with Server Actions matching the existing cart pattern. Auth state in httpOnly cookie (`_medusa_jwt`). `retrieveCustomer()` with `"use cache"` for data fetching. `useActionState` for form error display. TailwindUI Plus components from `tailwindplus-components.json` for all UI.

**Tech Stack:** Next.js 16, React 19, Medusa JS SDK, Headless UI, Tailwind CSS v4, TypeScript

**Design doc:** `docs/plans/2026-02-20-customer-accounts-design.md`

**Reference implementation:** `references/nextjs-starter-medusa/src/lib/data/customer.ts`

---

## Task 1: Add `customers` cache tag

**Files:**

- Modify: `lib/constants.ts:43-47`

**Step 1: Add the tag**

In `lib/constants.ts`, add `customers` to the `TAGS` object:

```typescript
export const TAGS = {
  collections: "collections",
  products: "products",
  cart: "cart",
  customers: "customers",
};
```

**Step 2: Verify build**

Run: `bun run build 2>&1 | head -20`
Expected: No TypeScript errors related to TAGS

**Step 3: Commit**

```bash
git add lib/constants.ts
git commit -m "feat: add customers cache tag to constants"
```

---

## Task 2: Create `lib/medusa/customer.ts` — auth functions

**Files:**

- Create: `lib/medusa/customer.ts`

**Context:**

- Follow the pattern in `components/cart/actions.ts` (Server Actions with try/catch/finally, return error strings)
- Follow the auth flow from `references/nextjs-starter-medusa/src/lib/data/customer.ts`
- Use `sdk` from `lib/medusa/index.ts` (exported as `sdk`)
- Use cookie functions from `lib/medusa/cookies.ts`
- Use `medusaError` from `lib/medusa/error.ts`
- The `revalidateTag` in this project takes a second argument `"max"` for immediate revalidation

**Step 1: Create the file with all auth functions**

Create `lib/medusa/customer.ts`:

```typescript
"use server";

import { sdk } from "lib/medusa";
import { TAGS } from "lib/constants";
import { medusaError } from "lib/medusa/error";
import type { HttpTypes } from "@medusajs/types";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAuthHeaders,
  getAuthToken,
  getCartId,
  removeAuthToken,
  removeCartId,
  setAuthToken,
} from "lib/medusa/cookies";

// --- Helpers ---

function revalidateCustomer(): void {
  revalidateTag(TAGS.customers, "max");
  revalidatePath("/", "layout");
}

async function transferCart(): Promise<void> {
  const cartId = await getCartId();
  if (!cartId) return;

  const headers = await getAuthHeaders();
  await sdk.store.cart.transferCart(cartId, {}, headers);
  revalidateTag(TAGS.cart, "max");
}

// --- Read ---

export async function retrieveCustomer(): Promise<HttpTypes.StoreCustomer | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const headers = await getAuthHeaders();

  try {
    const { customer } = await sdk.client.fetch<{
      customer: HttpTypes.StoreCustomer;
    }>("/store/customers/me", {
      method: "GET",
      headers,
      query: { fields: "*addresses" },
    });
    return customer;
  } catch {
    return null;
  }
}

// --- Auth Actions ---

export async function login(
  prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const token = await sdk.auth.login("customer", "emailpass", {
      email,
      password,
    });
    await setAuthToken(token as string);
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid email or password";
  }

  try {
    await transferCart();
  } catch {
    // Cart transfer is best-effort — don't block login
  }

  revalidateCustomer();
  redirect("/account");
}

export async function signup(
  prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const customerForm = {
    email,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: (formData.get("phone") as string) || undefined,
  };

  try {
    const registerToken = await sdk.auth.register("customer", "emailpass", {
      email,
      password,
    });
    await setAuthToken(registerToken as string);

    const headers = await getAuthHeaders();
    await sdk.store.customer.create(customerForm, {}, headers);

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email,
      password,
    });
    await setAuthToken(loginToken as string);
  } catch (e) {
    return e instanceof Error ? e.message : "Error creating account";
  }

  try {
    await transferCart();
  } catch {
    // Cart transfer is best-effort
  }

  revalidateCustomer();
  redirect("/account");
}

export async function signout(): Promise<void> {
  try {
    await sdk.auth.logout();
  } catch {
    // Logout endpoint may fail if token already expired — proceed anyway
  }

  await removeAuthToken();
  await removeCartId();

  revalidateTag(TAGS.customers, "max");
  revalidateTag(TAGS.cart, "max");
  revalidatePath("/", "layout");

  redirect("/");
}

// --- Profile ---

export async function updateCustomer(
  prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const body: HttpTypes.StoreUpdateCustomer = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: (formData.get("phone") as string) || undefined,
  };

  const headers = await getAuthHeaders();

  try {
    await sdk.store.customer.update(body, {}, headers);
  } catch (e) {
    return e instanceof Error ? e.message : "Error updating profile";
  } finally {
    revalidateCustomer();
  }

  return null;
}

// --- Addresses ---

export async function addCustomerAddress(
  prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: (formData.get("company") as string) || undefined,
    address_1: formData.get("address_1") as string,
    address_2: (formData.get("address_2") as string) || undefined,
    city: formData.get("city") as string,
    province: (formData.get("province") as string) || undefined,
    postal_code: formData.get("postal_code") as string,
    country_code: formData.get("country_code") as string,
    phone: (formData.get("phone") as string) || undefined,
  };

  const headers = await getAuthHeaders();

  try {
    await sdk.store.customer.createAddress(address, {}, headers);
  } catch (e) {
    return e instanceof Error ? e.message : "Error adding address";
  } finally {
    revalidateCustomer();
  }

  return null;
}

export async function updateCustomerAddress(
  prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const addressId = formData.get("address_id") as string;
  if (!addressId) return "Address ID is required";

  const address: HttpTypes.StoreUpdateCustomerAddress = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: (formData.get("company") as string) || undefined,
    address_1: formData.get("address_1") as string,
    address_2: (formData.get("address_2") as string) || undefined,
    city: formData.get("city") as string,
    province: (formData.get("province") as string) || undefined,
    postal_code: formData.get("postal_code") as string,
    country_code: formData.get("country_code") as string,
    phone: (formData.get("phone") as string) || undefined,
  };

  const headers = await getAuthHeaders();

  try {
    await sdk.store.customer.updateAddress(addressId, address, {}, headers);
  } catch (e) {
    return e instanceof Error ? e.message : "Error updating address";
  } finally {
    revalidateCustomer();
  }

  return null;
}

export async function deleteCustomerAddress(
  addressId: string,
): Promise<string | null> {
  const headers = await getAuthHeaders();

  try {
    await sdk.store.customer.deleteAddress(addressId, headers);
  } catch (e) {
    return e instanceof Error ? e.message : "Error deleting address";
  } finally {
    revalidateCustomer();
  }

  return null;
}
```

**Step 2: Add `getOrders()` to `lib/medusa/index.ts`**

Add before the `// --- Navigation ---` comment at line ~424:

```typescript
// --- Orders ---

export async function getOrders(): Promise<HttpTypes.StoreOrder[]> {
  const headers = await getAuthHeaders();
  if (!headers.authorization) return [];

  try {
    const { orders } = await sdk.client.fetch<{
      orders: HttpTypes.StoreOrder[];
    }>("/store/orders", {
      method: "GET",
      headers,
      query: { limit: 50, order: "-created_at" },
    });
    return orders;
  } catch {
    return [];
  }
}
```

Note: Add `import type { HttpTypes } from "@medusajs/types"` if not already imported (it is — check line 2).

**Step 3: Verify build**

Run: `bun run build 2>&1 | head -30`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add lib/medusa/customer.ts lib/medusa/index.ts lib/constants.ts
git commit -m "feat: add customer auth data layer and orders fetching"
```

---

## Task 3: Create login page

**Files:**

- Create: `app/(auth)/account/login/page.tsx`
- Create: `components/account/login-form.tsx`

**Context:**

- TailwindUI split-screen layout (form left, image right)
- Replace `indigo-600` with `primary-600` to match the project's theme tokens in `globals.css`
- Use `useActionState` from React 19 (not `react-dom`)
- The `login` Server Action is in `lib/medusa/customer.ts`
- If user is already logged in, redirect to `/account`

**Step 1: Create the login page**

Create `app/(auth)/account/login/page.tsx`:

```typescript
import { retrieveCustomer } from "lib/medusa/customer";
import { redirect } from "next/navigation";
import { LoginForm } from "components/account/login-form";
import Link from "next/link";

export const metadata = {
  title: "Sign In",
};

export default async function LoginPage() {
  const customer = await retrieveCustomer();
  if (customer) redirect("/account");

  return (
    <div className="flex min-h-full">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <img
              src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
              alt="Your Company"
              className="h-10 w-auto"
            />
            <h2 className="mt-8 text-2xl/9 font-bold tracking-tight text-gray-900">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm/6 text-gray-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/account/register"
                className="font-semibold text-primary-600 hover:text-primary-500"
              >
                Create one
              </Link>
            </p>
          </div>

          <div className="mt-10">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden w-0 flex-1 lg:block">
        <img
          src="https://images.unsplash.com/photo-1496917756835-20cb06e75b4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1908&q=80"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    </div>
  );
}
```

**Step 2: Create the login form component**

Create `components/account/login-form.tsx`:

```typescript
"use client";

import { login } from "lib/medusa/customer";
import { useActionState } from "react";

export function LoginForm() {
  const [error, formAction, isPending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm/6 font-medium text-gray-900"
        >
          Email address
        </label>
        <div className="mt-2">
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm/6 font-medium text-gray-900"
        >
          Password
        </label>
        <div className="mt-2">
          <input
            id="password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full justify-center rounded-md bg-primary-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </form>
  );
}
```

**Step 3: Verify dev server**

Run: `bun dev`
Navigate to: `http://localhost:3000/account/login`
Expected: Split screen layout with login form on left, image on right

**Step 4: Commit**

```bash
git add app/\(auth\)/account/login/page.tsx components/account/login-form.tsx
git commit -m "feat: add login page with split-screen layout"
```

---

## Task 4: Create register page

**Files:**

- Create: `app/(auth)/account/register/page.tsx`
- Create: `components/account/register-form.tsx`

**Step 1: Create the register page**

Create `app/(auth)/account/register/page.tsx`:

```typescript
import { retrieveCustomer } from "lib/medusa/customer";
import { redirect } from "next/navigation";
import { RegisterForm } from "components/account/register-form";
import Link from "next/link";

export const metadata = {
  title: "Create Account",
};

export default async function RegisterPage() {
  const customer = await retrieveCustomer();
  if (customer) redirect("/account");

  return (
    <div className="flex min-h-full">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <img
              src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
              alt="Your Company"
              className="h-10 w-auto"
            />
            <h2 className="mt-8 text-2xl/9 font-bold tracking-tight text-gray-900">
              Create your account
            </h2>
            <p className="mt-2 text-sm/6 text-gray-500">
              Already have an account?{" "}
              <Link
                href="/account/login"
                className="font-semibold text-primary-600 hover:text-primary-500"
              >
                Sign in
              </Link>
            </p>
          </div>

          <div className="mt-10">
            <RegisterForm />
          </div>
        </div>
      </div>
      <div className="relative hidden w-0 flex-1 lg:block">
        <img
          src="https://images.unsplash.com/photo-1496917756835-20cb06e75b4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1908&q=80"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    </div>
  );
}
```

**Step 2: Create the register form component**

Create `components/account/register-form.tsx`:

```typescript
"use client";

import { signup } from "lib/medusa/customer";
import { useActionState } from "react";

export function RegisterForm() {
  const [error, formAction, isPending] = useActionState(signup, null);

  return (
    <form action={formAction} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="first_name"
            className="block text-sm/6 font-medium text-gray-900"
          >
            First name
          </label>
          <div className="mt-2">
            <input
              id="first_name"
              type="text"
              name="first_name"
              required
              autoComplete="given-name"
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="last_name"
            className="block text-sm/6 font-medium text-gray-900"
          >
            Last name
          </label>
          <div className="mt-2">
            <input
              id="last_name"
              type="text"
              name="last_name"
              required
              autoComplete="family-name"
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
            />
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm/6 font-medium text-gray-900"
        >
          Email address
        </label>
        <div className="mt-2">
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="phone"
          className="block text-sm/6 font-medium text-gray-900"
        >
          Phone <span className="text-gray-400">(optional)</span>
        </label>
        <div className="mt-2">
          <input
            id="phone"
            type="tel"
            name="phone"
            autoComplete="tel"
            className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm/6 font-medium text-gray-900"
        >
          Password
        </label>
        <div className="mt-2">
          <input
            id="password"
            type="password"
            name="password"
            required
            autoComplete="new-password"
            className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full justify-center rounded-md bg-primary-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Creating account..." : "Create account"}
        </button>
      </div>
    </form>
  );
}
```

**Step 3: Verify dev server**

Navigate to: `http://localhost:3000/account/register`
Expected: Split screen with registration form (first name, last name, email, phone, password)

**Step 4: Commit**

```bash
git add app/\(auth\)/account/register/page.tsx components/account/register-form.tsx
git commit -m "feat: add register page with split-screen layout"
```

---

## Task 5: Create account layout with auth guard and tabs

**Files:**

- Create: `app/account/layout.tsx`
- Create: `components/account/account-tabs.tsx`

**Step 1: Create the account tabs component**

Create `components/account/account-tabs.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const tabs = [
  { name: "Profile", href: "/account" },
  { name: "Orders", href: "/account/orders" },
  { name: "Addresses", href: "/account/addresses" },
];

export function AccountTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Account">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/account"
              ? pathname === "/account"
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={clsx(
                "border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap",
                isActive
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

**Step 2: Create the account layout**

Create `app/account/layout.tsx`:

```typescript
import { retrieveCustomer } from "lib/medusa/customer";
import { redirect } from "next/navigation";
import { AccountTabs } from "components/account/account-tabs";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await retrieveCustomer();
  if (!customer) redirect("/account/login");

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        My Account
      </h1>
      <div className="mt-6">
        <AccountTabs />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/account/layout.tsx components/account/account-tabs.tsx
git commit -m "feat: add account layout with auth guard and top tabs"
```

---

## Task 6: Create profile page

**Files:**

- Create: `app/account/page.tsx`
- Create: `components/account/profile-form.tsx`

**Step 1: Create the profile form**

Create `components/account/profile-form.tsx`:

```typescript
"use client";

import { updateCustomer } from "lib/medusa/customer";
import type { HttpTypes } from "@medusajs/types";
import { useActionState } from "react";

export function ProfileForm({
  customer,
}: {
  customer: HttpTypes.StoreCustomer;
}) {
  const [error, formAction, isPending] = useActionState(updateCustomer, null);

  return (
    <form action={formAction}>
      <div className="space-y-8 sm:space-y-0 sm:divide-y sm:divide-gray-900/10 sm:border-t sm:border-t-gray-900/10">
        <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
          <label
            htmlFor="first_name"
            className="block text-sm/6 font-medium text-gray-900 sm:pt-1.5"
          >
            First name
          </label>
          <div className="mt-2 sm:col-span-2 sm:mt-0">
            <input
              id="first_name"
              type="text"
              name="first_name"
              defaultValue={customer.first_name || ""}
              autoComplete="given-name"
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:max-w-xs sm:text-sm/6"
            />
          </div>
        </div>

        <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
          <label
            htmlFor="last_name"
            className="block text-sm/6 font-medium text-gray-900 sm:pt-1.5"
          >
            Last name
          </label>
          <div className="mt-2 sm:col-span-2 sm:mt-0">
            <input
              id="last_name"
              type="text"
              name="last_name"
              defaultValue={customer.last_name || ""}
              autoComplete="family-name"
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:max-w-xs sm:text-sm/6"
            />
          </div>
        </div>

        <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
          <label className="block text-sm/6 font-medium text-gray-900 sm:pt-1.5">
            Email address
          </label>
          <div className="mt-2 sm:col-span-2 sm:mt-0">
            <p className="py-1.5 text-sm/6 text-gray-500">
              {customer.email}
            </p>
          </div>
        </div>

        <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-6">
          <label
            htmlFor="phone"
            className="block text-sm/6 font-medium text-gray-900 sm:pt-1.5"
          >
            Phone
          </label>
          <div className="mt-2 sm:col-span-2 sm:mt-0">
            <input
              id="phone"
              type="tel"
              name="phone"
              defaultValue={customer.phone || ""}
              autoComplete="tel"
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:max-w-xs sm:text-sm/6"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-x-6">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
```

**Step 2: Create the profile page**

Create `app/account/page.tsx`:

```typescript
import { retrieveCustomer } from "lib/medusa/customer";
import { ProfileForm } from "components/account/profile-form";

export const metadata = {
  title: "My Account",
};

export default async function AccountPage() {
  const customer = await retrieveCustomer();

  // Layout guard handles redirect — customer is always non-null here
  if (!customer) return null;

  return (
    <div>
      <h2 className="text-base/7 font-semibold text-gray-900">
        Personal Information
      </h2>
      <p className="mt-1 max-w-2xl text-sm/6 text-gray-600">
        Update your name and contact details.
      </p>
      <div className="mt-10">
        <ProfileForm customer={customer} />
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/account/page.tsx components/account/profile-form.tsx
git commit -m "feat: add profile page with labels-on-left form layout"
```

---

## Task 7: Create orders page

**Files:**

- Create: `app/account/orders/page.tsx`
- Create: `components/account/order-card.tsx`

**Context:**

- Uses TailwindUI "Invoice panels" layout from `tailwindplus-components.json`
- Fetches orders via `getOrders()` from `lib/medusa/index.ts`
- Medusa v2 order type: `HttpTypes.StoreOrder` with `id`, `display_id`, `created_at`, `total`, `status`, `items`
- Price values are NOT in cents (Medusa v2) — display as-is with `toFixed(2)`
- Order items have `item.title`, `item.thumbnail`, `item.unit_price`, `item.quantity`
- Link "View product" to `/product/[handle]` using `item.product_handle` if available

**Step 1: Create the order card component**

Create `components/account/order-card.tsx`:

```typescript
import type { HttpTypes } from "@medusajs/types";
import Link from "next/link";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMoney(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

export function OrderCard({ order }: { order: HttpTypes.StoreOrder }) {
  const currencyCode = order.currency_code || "usd";

  return (
    <div className="border-b border-t border-gray-200 bg-white shadow-sm sm:rounded-lg sm:border">
      <div className="flex items-center border-b border-gray-200 p-4 sm:grid sm:grid-cols-4 sm:gap-x-6 sm:p-6">
        <dl className="grid flex-1 grid-cols-2 gap-x-6 text-sm sm:col-span-3 sm:grid-cols-3 lg:col-span-2">
          <div>
            <dt className="font-medium text-gray-900">Order number</dt>
            <dd className="mt-1 text-gray-500">#{order.display_id}</dd>
          </div>
          <div className="hidden sm:block">
            <dt className="font-medium text-gray-900">Date placed</dt>
            <dd className="mt-1 text-gray-500">
              <time dateTime={order.created_at as string}>
                {formatDate(order.created_at as string)}
              </time>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Total amount</dt>
            <dd className="mt-1 font-medium text-gray-900">
              {formatMoney(order.total as number, currencyCode)}
            </dd>
          </div>
        </dl>
      </div>

      <h4 className="sr-only">Items</h4>
      <ul role="list" className="divide-y divide-gray-200">
        {order.items?.map((item) => (
          <li key={item.id} className="p-4 sm:p-6">
            <div className="flex items-center sm:items-start">
              <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-gray-200 sm:size-40">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-gray-400">
                    No image
                  </div>
                )}
              </div>
              <div className="ml-6 flex-1 text-sm">
                <div className="font-medium text-gray-900 sm:flex sm:justify-between">
                  <h5>{item.title}</h5>
                  <p className="mt-2 sm:mt-0">
                    {formatMoney(item.unit_price as number, currencyCode)}
                  </p>
                </div>
                <p className="hidden text-gray-500 sm:mt-2 sm:block">
                  Qty: {item.quantity}
                </p>
              </div>
            </div>

            {item.product_handle && (
              <div className="mt-6 flex items-center border-t border-gray-200 pt-4 text-sm font-medium">
                <Link
                  href={`/product/${item.product_handle}`}
                  className="text-primary-600 hover:text-primary-500"
                >
                  View product
                </Link>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Step 2: Create the orders page**

Create `app/account/orders/page.tsx`:

```typescript
import { getOrders } from "lib/medusa";
import { OrderCard } from "components/account/order-card";

export const metadata = {
  title: "Order History",
};

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <div>
      <h2 className="text-base/7 font-semibold text-gray-900">
        Order History
      </h2>
      <p className="mt-1 max-w-2xl text-sm/6 text-gray-600">
        Check the status of recent orders and manage returns.
      </p>

      <div className="mt-10">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              You haven&apos;t placed any orders yet.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/account/orders/page.tsx components/account/order-card.tsx
git commit -m "feat: add order history page with invoice panel cards"
```

---

## Task 8: Create addresses page

**Files:**

- Create: `app/account/addresses/page.tsx`
- Create: `components/account/address-card.tsx`
- Create: `components/account/address-form.tsx`

**Context:**

- Customer addresses come from `retrieveCustomer()` with `*addresses` field expansion
- Address type: `HttpTypes.StoreCustomerAddress`
- TailwindUI "Stacked" form layout for the address form
- Delete uses `deleteCustomerAddress` Server Action with a simple confirm() dialog (no Headless UI needed)

**Step 1: Create the address card**

Create `components/account/address-card.tsx`:

```typescript
"use client";

import { deleteCustomerAddress } from "lib/medusa/customer";
import type { HttpTypes } from "@medusajs/types";

export function AddressCard({
  address,
  onEdit,
}: {
  address: HttpTypes.StoreCustomerAddress;
  onEdit: () => void;
}) {
  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this address?")) return;
    await deleteCustomerAddress(address.id);
  }

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <p className="font-medium text-gray-900">
        {address.first_name} {address.last_name}
      </p>
      {address.company && (
        <p className="mt-1 text-sm text-gray-500">{address.company}</p>
      )}
      <p className="mt-1 text-sm text-gray-500">{address.address_1}</p>
      {address.address_2 && (
        <p className="text-sm text-gray-500">{address.address_2}</p>
      )}
      <p className="text-sm text-gray-500">
        {address.city}
        {address.province ? `, ${address.province}` : ""}{" "}
        {address.postal_code}
      </p>
      <p className="text-sm text-gray-500 uppercase">
        {address.country_code}
      </p>
      {address.phone && (
        <p className="mt-1 text-sm text-gray-500">{address.phone}</p>
      )}

      <div className="mt-4 flex gap-4 text-sm font-medium">
        <button
          type="button"
          onClick={onEdit}
          className="text-primary-600 hover:text-primary-500"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="text-red-600 hover:text-red-500"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Create the address form**

Create `components/account/address-form.tsx`:

```typescript
"use client";

import {
  addCustomerAddress,
  updateCustomerAddress,
} from "lib/medusa/customer";
import type { HttpTypes } from "@medusajs/types";
import { useActionState } from "react";

export function AddressForm({
  address,
  onClose,
}: {
  address?: HttpTypes.StoreCustomerAddress;
  onClose: () => void;
}) {
  const action = address ? updateCustomerAddress : addCustomerAddress;
  const [error, formAction, isPending] = useActionState(
    async (prevState: string | null, formData: FormData) => {
      const result = await action(prevState, formData);
      if (!result) onClose();
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {address && (
        <input type="hidden" name="address_id" value={address.id} />
      )}

      <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label htmlFor="first_name" className="block text-sm/6 font-medium text-gray-900">
            First name
          </label>
          <div className="mt-2">
            <input id="first_name" type="text" name="first_name" required defaultValue={address?.first_name || ""} autoComplete="given-name" className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6" />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="last_name" className="block text-sm/6 font-medium text-gray-900">
            Last name
          </label>
          <div className="mt-2">
            <input id="last_name" type="text" name="last_name" required defaultValue={address?.last_name || ""} autoComplete="family-name" className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6" />
          </div>
        </div>

        <div className="col-span-full">
          <label htmlFor="company" className="block text-sm/6 font-medium text-gray-900">
            Company <span className="text-gray-400">(optional)</span>
          </label>
          <div className="mt-2">
            <input id="company" type="text" name="company" defaultValue={address?.company || ""} autoComplete="organization" className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6" />
          </div>
        </div>

        <div className="col-span-full">
          <label htmlFor="address_1" className="block text-sm/6 font-medium text-gray-900">
            Address line 1
          </label>
          <div className="mt-2">
            <input id="address_1" type="text" name="address_1" required defaultValue={address?.address_1 || ""} autoComplete="address-line1" className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6" />
          </div>
        </div>

        <div className="col-span-full">
          <label htmlFor="address_2" className="block text-sm/6 font-medium text-gray-900">
            Address line 2 <span className="text-gray-400">(optional)</span>
          </label>
          <div className="mt-2">
            <input id="address_2" type="text" name="address_2" defaultValue={address?.address_2 || ""} autoComplete="address-line2" className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6" />
          </div>
        </div>

        <div className="sm:col-span-2 sm:col-start-1">
          <label htmlFor="city" className="block text-sm/6 font-medium text-gray-900">
            City
          </label>
          <div className="mt-2">
            <input id="city" type="text" name="city" required defaultValue={address?.city || ""} autoComplete="address-level2" className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6" />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="province" className="block text-sm/6 font-medium text-gray-900">
            State / Province
          </label>
          <div className="mt-2">
            <input id="province" type="text" name="province" defaultValue={address?.province || ""} autoComplete="address-level1" className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6" />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="postal_code" className="block text-sm/6 font-medium text-gray-900">
            ZIP / Postal code
          </label>
          <div className="mt-2">
            <input id="postal_code" type="text" name="postal_code" required defaultValue={address?.postal_code || ""} autoComplete="postal-code" className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6" />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="country_code" className="block text-sm/6 font-medium text-gray-900">
            Country
          </label>
          <div className="mt-2">
            <input id="country_code" type="text" name="country_code" required defaultValue={address?.country_code || ""} placeholder="us" autoComplete="country" className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:max-w-xs sm:text-sm/6" />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="phone" className="block text-sm/6 font-medium text-gray-900">
            Phone <span className="text-gray-400">(optional)</span>
          </label>
          <div className="mt-2">
            <input id="phone" type="tel" name="phone" defaultValue={address?.phone || ""} autoComplete="tel" className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:max-w-xs sm:text-sm/6" />
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-x-6">
        <button type="button" onClick={onClose} className="text-sm/6 font-semibold text-gray-900">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : address ? "Update address" : "Add address"}
        </button>
      </div>
    </form>
  );
}
```

**Step 3: Create the addresses page**

Create `app/account/addresses/page.tsx`:

```typescript
import { retrieveCustomer } from "lib/medusa/customer";
import { AddressesClient } from "components/account/addresses-client";

export const metadata = {
  title: "Addresses",
};

export default async function AddressesPage() {
  const customer = await retrieveCustomer();
  if (!customer) return null;

  return (
    <div>
      <h2 className="text-base/7 font-semibold text-gray-900">Addresses</h2>
      <p className="mt-1 max-w-2xl text-sm/6 text-gray-600">
        Manage your shipping and billing addresses.
      </p>
      <div className="mt-10">
        <AddressesClient addresses={customer.addresses || []} />
      </div>
    </div>
  );
}
```

**Step 4: Create the addresses client wrapper**

Create `components/account/addresses-client.tsx` — this manages the add/edit form state:

```typescript
"use client";

import type { HttpTypes } from "@medusajs/types";
import { useState } from "react";
import { AddressCard } from "./address-card";
import { AddressForm } from "./address-form";

export function AddressesClient({
  addresses,
}: {
  addresses: HttpTypes.StoreCustomerAddress[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => {
            setShowAddForm(true);
            setEditingId(null);
          }}
          className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          Add new address
        </button>
      </div>

      {showAddForm && (
        <div className="mb-8 rounded-lg border border-gray-200 p-6">
          <h3 className="mb-4 text-sm font-medium text-gray-900">
            New address
          </h3>
          <AddressForm onClose={() => setShowAddForm(false)} />
        </div>
      )}

      {addresses.length === 0 && !showAddForm ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">
            You don&apos;t have any saved addresses yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {addresses.map((address) =>
            editingId === address.id ? (
              <div
                key={address.id}
                className="rounded-lg border border-gray-200 p-6"
              >
                <h3 className="mb-4 text-sm font-medium text-gray-900">
                  Edit address
                </h3>
                <AddressForm
                  address={address}
                  onClose={() => setEditingId(null)}
                />
              </div>
            ) : (
              <AddressCard
                key={address.id}
                address={address}
                onEdit={() => {
                  setEditingId(address.id);
                  setShowAddForm(false);
                }}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add app/account/addresses/page.tsx components/account/address-card.tsx components/account/address-form.tsx components/account/addresses-client.tsx
git commit -m "feat: add addresses page with address CRUD"
```

---

## Task 9: Create account dropdown for navbar

**Files:**

- Create: `components/account/account-dropdown.tsx`

**Context:**

- Uses Headless UI `Menu` component (already a dependency — used for mobile nav)
- Based on TailwindUI "Dropdowns > With icons" pattern
- Sign out triggers `signout()` Server Action via `<form action={signout}>`
- Shows user initials in a circular avatar

**Step 1: Create the dropdown component**

Create `components/account/account-dropdown.tsx`:

```typescript
"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  UserIcon,
  ClipboardDocumentListIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { signout } from "lib/medusa/customer";
import Link from "next/link";

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

export function AccountDropdown({
  firstName,
  lastName,
}: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  return (
    <Menu as="div" className="relative">
      <MenuButton className="flex items-center rounded-full bg-primary-100 text-sm font-medium text-primary-700 hover:bg-primary-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
        <span className="sr-only">Open user menu</span>
        <span className="inline-flex size-8 items-center justify-center rounded-full">
          {getInitials(firstName, lastName)}
        </span>
      </MenuButton>

      <MenuItems
        transition
        className="absolute right-0 z-50 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 transition focus:outline-none data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-leave:duration-75 data-enter:ease-out data-leave:ease-in"
      >
        <div className="py-1">
          <MenuItem>
            <Link
              href="/account"
              className="group flex items-center px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900"
            >
              <UserIcon className="mr-3 size-5 text-gray-400 group-data-focus:text-gray-500" />
              My Account
            </Link>
          </MenuItem>
          <MenuItem>
            <Link
              href="/account/orders"
              className="group flex items-center px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900"
            >
              <ClipboardDocumentListIcon className="mr-3 size-5 text-gray-400 group-data-focus:text-gray-500" />
              Order History
            </Link>
          </MenuItem>
        </div>
        <div className="py-1">
          <MenuItem>
            <form action={signout}>
              <button
                type="submit"
                className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900"
              >
                <ArrowRightStartOnRectangleIcon className="mr-3 size-5 text-gray-400 group-data-focus:text-gray-500" />
                Sign out
              </button>
            </form>
          </MenuItem>
        </div>
      </MenuItems>
    </Menu>
  );
}
```

**Step 2: Commit**

```bash
git add components/account/account-dropdown.tsx
git commit -m "feat: add account dropdown menu component"
```

---

## Task 10: Update navbar with auth-aware display

**Files:**

- Modify: `components/layout/navbar/navbar-data.tsx`
- Modify: `components/layout/navbar/navbar-client.tsx`

**Context:**

- `navbar-data.tsx` is a server component that fetches navigation data. Add `retrieveCustomer()` call here.
- `navbar-client.tsx` receives props and renders the full navbar. Add `customer` prop and conditional auth display.
- The commented-out account link is at lines 298-302 of `navbar-client.tsx`.
- Import `UserIcon` from `@heroicons/react/24/outline` (already used: `Bars3Icon`, `XMarkIcon`).

**Step 1: Update navbar-data.tsx**

In `components/layout/navbar/navbar-data.tsx`, add customer fetching:

```typescript
import { getNavigation } from "lib/medusa";
import { retrieveCustomer } from "lib/medusa/customer";
import NavbarClient from "./navbar-client";

export default async function NavbarData() {
  "use cache";
  const [navigation, customer] = await Promise.all([
    getNavigation(),
    retrieveCustomer(),
  ]);

  const customerData = customer
    ? {
        firstName: customer.first_name,
        lastName: customer.last_name,
      }
    : null;

  return <NavbarClient navigation={navigation} customer={customerData} />;
}
```

**Step 2: Update navbar-client.tsx**

Add the `customer` prop and replace the commented-out account section (lines 294-308). The changes are:

1. Add `customer` prop to component signature
2. Import `AccountDropdown` and `Link`
3. Replace the commented-out account section with conditional rendering
4. Add auth links to the mobile menu

In the component props, add:

```typescript
export default function NavbarClient({
  navigation,
  customer,
}: {
  navigation: Navigation;
  customer: { firstName: string | null; lastName: string | null } | null;
}) {
```

Replace the commented-out account section (around line 296-302) with:

```tsx
{
  /* Account */
}
<div className="lg:ml-4">
  {customer ? (
    <AccountDropdown
      firstName={customer.firstName}
      lastName={customer.lastName}
    />
  ) : (
    <Link
      href="/account/login"
      className="p-2 text-sm font-medium text-gray-700 hover:text-gray-800"
    >
      Sign in
    </Link>
  )}
</div>;
```

Add to mobile menu (after the `navigation.pages` section, around line 246):

```tsx
<div className="space-y-6 border-t border-gray-200 px-4 py-6">
  {customer ? (
    <>
      <div className="flow-root">
        <Link
          href="/account"
          className="-m-2 block p-2 font-medium text-gray-900"
        >
          My Account
        </Link>
      </div>
      <div className="flow-root">
        <Link
          href="/account/orders"
          className="-m-2 block p-2 font-medium text-gray-900"
        >
          Order History
        </Link>
      </div>
      <div className="flow-root">
        <form action={signout}>
          <button
            type="submit"
            className="-m-2 block p-2 font-medium text-gray-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </>
  ) : (
    <>
      <div className="flow-root">
        <Link
          href="/account/login"
          className="-m-2 block p-2 font-medium text-gray-900"
        >
          Sign in
        </Link>
      </div>
      <div className="flow-root">
        <Link
          href="/account/register"
          className="-m-2 block p-2 font-medium text-gray-900"
        >
          Create account
        </Link>
      </div>
    </>
  )}
</div>
```

Add imports at the top of `navbar-client.tsx`:

```typescript
import { AccountDropdown } from "components/account/account-dropdown";
import { signout } from "lib/medusa/customer";
```

**Step 3: Verify dev server**

Run: `bun dev`
Navigate to: `http://localhost:3000`
Expected: "Sign in" link visible in navbar. After logging in, initials avatar with dropdown.

**Step 4: Commit**

```bash
git add components/layout/navbar/navbar-data.tsx components/layout/navbar/navbar-client.tsx
git commit -m "feat: add auth-aware navigation with account dropdown"
```

---

## Task 11: Manual smoke test

**Files:** None (verification only)

**Step 1: Start Medusa backend**

```bash
cd ../medusa-backend && npm run dev
```

Verify: `http://localhost:9000` responds

**Step 2: Start storefront**

```bash
bun dev
```

**Step 3: Test signup flow**

1. Navigate to `http://localhost:3000/account/register`
2. Fill in: First name, Last name, Email, Password
3. Submit
4. Expected: Redirect to `/account`, profile page shows your data, navbar shows initials

**Step 4: Test signout flow**

1. Click initials avatar in navbar
2. Click "Sign out"
3. Expected: Redirect to `/`, navbar shows "Sign in" link

**Step 5: Test login flow**

1. Navigate to `http://localhost:3000/account/login`
2. Enter the email and password from signup
3. Submit
4. Expected: Redirect to `/account`

**Step 6: Test auth guard**

1. Sign out
2. Navigate directly to `http://localhost:3000/account`
3. Expected: Redirect to `/account/login`

**Step 7: Test inverse guard**

1. Sign in
2. Navigate directly to `http://localhost:3000/account/login`
3. Expected: Redirect to `/account`

**Step 8: Test cart transfer**

1. Sign out
2. Add an item to cart (browse products, add to cart)
3. Sign in
4. Expected: Cart still shows the item you added

---

## Task 12: Update TODO.md and commit

**Files:**

- Modify: `TODO.md`

**Step 1: Mark completed phases**

Update the Customer Accounts Implementation section in `TODO.md`:

- Mark Phase 1 items as `[x]`
- Mark Phase 2 items as `[x]`
- Mark Phase 3 items as `[x]`
- Mark Phase 4 items as `[x]`

**Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: mark customer accounts phases 1-4 as complete"
```
