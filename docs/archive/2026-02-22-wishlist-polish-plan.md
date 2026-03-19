# Wishlist Phase 2 Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete 4 remaining wishlist polish features — nav badge, heart button server state, rename/delete UI, and social proof count.

**Architecture:** All 4 features build on existing server actions and backend routes. Features 1–3 are pure storefront UI changes. Feature 4 adds a new backend store route and storefront components.

**Tech Stack:** Next.js 16 (RSC + Server Actions), Headless UI, Heroicons, Medusa v2 backend, TailwindCSS

---

### Task 1: Nav Wishlist Badge

Add a heart icon with item count to the header, next to the cart icon.

**Files:**
- Create: `storefront/components/wishlist/wishlist-nav.tsx`
- Modify: `storefront/components/layout/navbar/navbar-data.tsx`
- Modify: `storefront/components/layout/navbar/navbar-client.tsx`

**Step 1: Create the WishlistNav server component**

Create `storefront/components/wishlist/wishlist-nav.tsx`:

```tsx
import { HeartIcon } from "@heroicons/react/24/outline";
import { getWishlistItemCount } from "lib/medusa/wishlist";
import Link from "next/link";

export async function WishlistNav() {
  const count = await getWishlistItemCount();

  return (
    <Link
      href="/account/wishlist"
      className="group -m-2 flex items-center rounded-md p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
    >
      <HeartIcon
        aria-hidden="true"
        className="size-6 shrink-0 text-gray-400 group-hover:text-gray-500"
      />
      {count > 0 && (
        <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-gray-800">
          {count}
        </span>
      )}
      <span className="sr-only">items in wishlist</span>
    </Link>
  );
}
```

This follows the exact same pattern as the Cart button in `components/cart/index.tsx:59-73` — icon + count + sr-only label.

**Step 2: Pass wishlist count to NavbarClient**

The `WishlistNav` is a server component that uses `cookies()` via `getWishlistItemCount()` → `getWishlists()` → `getAuthToken()`. The product page has `"use cache"` which prevents calling `cookies()`. So we need to pass the count as data to the client navbar rather than rendering `WishlistNav` as a server component inside the navbar.

Modify `storefront/components/layout/navbar/navbar-data.tsx`:

```tsx
import { getNavigation } from "lib/medusa";
import { retrieveCustomer } from "lib/medusa/customer";
import { getWishlistItemCount } from "lib/medusa/wishlist";
import { NavbarClient } from "./navbar-client";

export async function NavbarData() {
  const [navigation, customer, wishlistCount] = await Promise.all([
    getNavigation(),
    retrieveCustomer(),
    getWishlistItemCount(),
  ]);

  const customerData = customer
    ? {
        firstName: customer.first_name,
        lastName: customer.last_name,
      }
    : null;

  return (
    <NavbarClient
      navigation={navigation}
      customer={customerData}
      wishlistCount={wishlistCount}
    />
  );
}
```

**Step 3: Add heart icon to NavbarClient**

Modify `storefront/components/layout/navbar/navbar-client.tsx`:

1. Add import: `import { HeartIcon } from "@heroicons/react/24/outline";`
2. Add `Link` import (already imported).
3. Add `wishlistCount` to `NavbarClientProps`:

```tsx
type NavbarClientProps = {
  navigation: Navigation;
  customer: CustomerData | null;
  wishlistCount: number;
};
```

4. Update the function signature to accept `wishlistCount`.

5. Add the heart icon between the Account section and the Cart section (around line 371, after the Account `</div>` and before the Cart `<div>`):

```tsx
{/* Wishlist */}
<div className="ml-4 flow-root lg:ml-6">
  <Link
    href="/account/wishlist"
    className="group -m-2 flex items-center rounded-md p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
  >
    <HeartIcon
      aria-hidden="true"
      className="size-6 shrink-0 text-gray-400 group-hover:text-gray-500"
    />
    {wishlistCount > 0 && (
      <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-gray-800">
        {wishlistCount}
      </span>
    )}
    <span className="sr-only">items in wishlist</span>
  </Link>
</div>
```

**Step 4: Verify manually**

Run: `cd storefront && bun dev`

- Visit http://localhost:3000
- Heart icon should appear in the header between Account and Cart
- If you have wishlist items, count should display next to the heart
- Click the heart — should navigate to `/account/wishlist`

**Step 5: Commit**

```bash
git add storefront/components/wishlist/wishlist-nav.tsx storefront/components/layout/navbar/navbar-data.tsx storefront/components/layout/navbar/navbar-client.tsx
git commit -m "feat: add wishlist heart icon with count badge to nav header"
```

---

### Task 2: Heart Button Server State

Make heart buttons on product cards and PDP reflect whether the variant is already in the user's wishlist.

**Files:**
- Modify: `storefront/lib/medusa/wishlist.ts` (add `getVariantWishlistState()`)
- Modify: `storefront/components/layout/product-grid.tsx` (pass wishlist state to hearts)
- Modify: `storefront/components/product/product-detail.tsx` (pass wishlist state to PDP heart)
- Modify: `storefront/components/product/product-wrapper.tsx` (thread wishlist state)
- Modify: `storefront/components/product/product-page-content.tsx` (thread wishlist state)
- Modify: `storefront/app/product/[handle]/page.tsx` (fetch wishlist state)

**Step 1: Add `getVariantWishlistState()` to wishlist.ts**

Add this function after `isVariantInWishlist` (line 126) in `storefront/lib/medusa/wishlist.ts`:

```tsx
export type VariantWishlistState = {
  isInWishlist: boolean;
  wishlistId?: string;
  wishlistItemId?: string;
};

export async function getVariantWishlistState(
  variantId: string,
): Promise<VariantWishlistState> {
  const wishlists = await getWishlists();
  for (const wl of wishlists) {
    const item = wl.items?.find(
      (item) => item.product_variant_id === variantId,
    );
    if (item) {
      return {
        isInWishlist: true,
        wishlistId: wl.id,
        wishlistItemId: item.id,
      };
    }
  }
  return { isInWishlist: false };
}

export async function getVariantsWishlistStates(
  variantIds: string[],
): Promise<Map<string, VariantWishlistState>> {
  const wishlists = await getWishlists();
  const states = new Map<string, VariantWishlistState>();

  for (const id of variantIds) {
    states.set(id, { isInWishlist: false });
  }

  for (const wl of wishlists) {
    for (const item of wl.items ?? []) {
      if (variantIds.includes(item.product_variant_id)) {
        states.set(item.product_variant_id, {
          isInWishlist: true,
          wishlistId: wl.id,
          wishlistItemId: item.id,
        });
      }
    }
  }

  return states;
}
```

We need `getVariantsWishlistStates` (plural) for the product grid — it fetches wishlists once and checks multiple variants. Otherwise each product card would trigger a separate `getWishlists()` call.

**Step 2: Update ProductGrid to pass wishlist state**

`product-grid.tsx` is currently a sync server component. We need to make it async and fetch wishlist states for all displayed products.

Modify `storefront/components/layout/product-grid.tsx`:

```tsx
import ProductGridPrice from "components/price/product-grid-price";
import { WishlistButton } from "components/wishlist/wishlist-button";
import { getVariantsWishlistStates } from "lib/medusa/wishlist";
import { Product } from "lib/types";
import Image from "next/image";
import Link from "next/link";

export default async function ProductGrid({ products }: { products: Product[] }) {
  const variantIds = products
    .map((p) => p.variants?.[0]?.id)
    .filter((id): id is string => Boolean(id));

  const wishlistStates = await getVariantsWishlistStates(variantIds);

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
      {products.map((product) => {
        const variantId = product.variants?.[0]?.id ?? "";
        const wlState = wishlistStates.get(variantId);
        return (
          <div key={product.id} className="group animate-fadeIn">
            <div className="relative">
              <Link
                href={`/product/${product.handle}`}
                prefetch={true}
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-200">
                  <Image
                    alt={product.featuredImage?.altText || product.title}
                    src={
                      product.featuredImage?.url || "https://via.placeholder.com/400"
                    }
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-300 ease-in-out group-hover:scale-105"
                  />
                </div>
              </Link>
              <div className="absolute right-2 top-2 z-10">
                <WishlistButton
                  variantId={variantId}
                  isInWishlist={wlState?.isInWishlist}
                  wishlistId={wlState?.wishlistId}
                  wishlistItemId={wlState?.wishlistItemId}
                  size="sm"
                  className="bg-white/80 shadow-sm backdrop-blur-sm hover:bg-white"
                />
              </div>
            </div>
            <Link href={`/product/${product.handle}`} prefetch={true}>
              <h3 className="mt-4 text-sm text-gray-700">{product.title}</h3>
              <ProductGridPrice
                amount={product.priceRange.maxVariantPrice.amount}
                currencyCode={product.priceRange.maxVariantPrice.currencyCode}
              />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: Thread wishlist state through the PDP**

The PDP has `"use cache"` on the page component, so we **cannot** call `cookies()` there. The wishlist state must be fetched outside the cached scope — in a Suspense boundary or passed as a promise.

**Important constraint:** `app/product/[handle]/page.tsx` has `"use cache"` at the top. We cannot call `getVariantWishlistState()` inside it because it uses `cookies()`. Instead, we'll create a client-side wrapper that fetches wishlist state after mount.

Actually, the simpler approach: the `WishlistButton` is already a client component. We can add a `useEffect` to it that checks wishlist state on mount. But that adds complexity to the button.

**Better approach:** Create a wrapper server component that's rendered in a `<Suspense>` boundary outside the cache scope. But the page itself has `"use cache"` — everything inside it is cached.

**Simplest approach:** The `product-detail.tsx` already renders the `WishlistButton` with `selectedVariantId`. Since the variant changes on the client (option picker), we should use a client-side check. Let's add a hook that fetches wishlist state for the selected variant.

Create a new server action `checkVariantWishlistState` that the button can call on mount:

Add to `storefront/lib/medusa/wishlist.ts`:

```tsx
export async function checkVariantWishlistState(
  variantId: string,
): Promise<VariantWishlistState> {
  return getVariantWishlistState(variantId);
}
```

Then update `storefront/components/wishlist/wishlist-button.tsx` to auto-check wishlist state on mount when `isInWishlist` is not explicitly provided:

```tsx
"use client";

import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { useEffect, useState, useTransition } from "react";
import {
  addToWishlist,
  removeFromWishlist,
  checkVariantWishlistState,
  type WishlistActionResult,
} from "lib/medusa/wishlist";
import { useNotification } from "components/notifications";
import clsx from "clsx";

type WishlistButtonProps = {
  variantId: string;
  isInWishlist?: boolean;
  wishlistId?: string;
  wishlistItemId?: string;
  size?: "sm" | "md";
  className?: string;
};

export function WishlistButton({
  variantId,
  isInWishlist: initialIsInWishlist,
  wishlistId: initialWishlistId,
  wishlistItemId: initialWishlistItemId,
  size = "md",
  className,
}: WishlistButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(initialIsInWishlist ?? false);
  const [wishlistId, setWishlistId] = useState(initialWishlistId);
  const [wishlistItemId, setWishlistItemId] = useState(initialWishlistItemId);
  const [isPending, startTransition] = useTransition();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (initialIsInWishlist !== undefined) {
      setIsWishlisted(initialIsInWishlist);
      setWishlistId(initialWishlistId);
      setWishlistItemId(initialWishlistItemId);
      return;
    }

    // Auto-check wishlist state when not provided by server
    let cancelled = false;
    checkVariantWishlistState(variantId).then((state) => {
      if (cancelled) return;
      setIsWishlisted(state.isInWishlist);
      setWishlistId(state.wishlistId);
      setWishlistItemId(state.wishlistItemId);
    });
    return () => { cancelled = true; };
  }, [variantId, initialIsInWishlist, initialWishlistId, initialWishlistItemId]);

  function handleClick() {
    startTransition(async () => {
      if (isWishlisted && wishlistId && wishlistItemId) {
        const formData = new FormData();
        formData.set("wishlist_id", wishlistId);
        formData.set("item_id", wishlistItemId);
        const result = await removeFromWishlist(null, formData);
        if (result?.error) {
          showNotification("error", "Could not remove from wishlist", result.error);
        } else {
          setIsWishlisted(false);
          setWishlistId(undefined);
          setWishlistItemId(undefined);
          showNotification("success", "Removed from wishlist");
        }
      } else {
        const formData = new FormData();
        formData.set("variant_id", variantId);
        if (wishlistId) formData.set("wishlist_id", wishlistId);
        const result = await addToWishlist(null, formData);
        if (result?.error) {
          showNotification("error", "Could not add to wishlist", result.error);
        } else {
          setIsWishlisted(true);
          // Refresh state to get the new wishlistId and itemId
          const newState = await checkVariantWishlistState(variantId);
          setWishlistId(newState.wishlistId);
          setWishlistItemId(newState.wishlistItemId);
          showNotification("success", "Added to wishlist");
        }
      }
    });
  }

  const iconSize = size === "sm" ? "size-5" : "size-6";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={clsx(
        "group/heart rounded-full p-2 transition-colors",
        isWishlisted
          ? "text-red-500 hover:text-red-600"
          : "text-gray-400 hover:text-red-500",
        isPending && "opacity-50",
        className,
      )}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      {isWishlisted ? (
        <HeartSolid className={clsx(iconSize, isPending && "animate-pulse")} />
      ) : (
        <HeartOutline className={clsx(iconSize, "group-hover/heart:fill-red-100")} />
      )}
    </button>
  );
}
```

This approach handles both cases:
- **Product grid** (server component): passes `isInWishlist`, `wishlistId`, `wishlistItemId` from server
- **PDP** (inside `"use cache"`): omits `isInWishlist` prop → button auto-checks on mount via server action

**Step 4: Verify manually**

- Visit a product listing page — hearts should show filled (red) for products already in wishlist
- Visit a PDP — heart should show filled after mount if variant is wishlisted
- Add/remove from wishlist — heart should toggle correctly
- Change variant options on PDP — heart should update for the new variant

**Step 5: Commit**

```bash
git add storefront/lib/medusa/wishlist.ts storefront/components/layout/product-grid.tsx storefront/components/wishlist/wishlist-button.tsx
git commit -m "feat: heart buttons reflect current wishlist state"
```

---

### Task 3: Rename/Delete Wishlist UI

Add an actions dropdown menu to the wishlist page header with Rename and Delete options.

**Files:**
- Modify: `storefront/components/wishlist/wishlist-page-client.tsx`

**Step 1: Add the actions menu with Rename and Delete**

Modify `storefront/components/wishlist/wishlist-page-client.tsx`:

1. Add imports at the top:

```tsx
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import {
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  deleteWishlist,
  renameWishlist,
} from "lib/medusa/wishlist";
```

Note: `deleteWishlist` and `renameWishlist` are already exported from `lib/medusa/wishlist` but not imported in the page client. Update the existing import to include them.

2. Add a `WishlistActionsMenu` component before the closing export. This component renders an ellipsis dropdown with Rename and Delete options:

```tsx
function WishlistActionsMenu({
  wishlist,
  onDeleted,
}: {
  wishlist: Wishlist;
  onDeleted: () => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Menu as="div" className="relative">
        <MenuButton className="inline-flex items-center rounded-md bg-white p-2 text-gray-400 ring-1 shadow-sm ring-gray-300 ring-inset hover:bg-gray-50 hover:text-gray-500">
          <span className="sr-only">Wishlist options</span>
          <EllipsisVerticalIcon className="size-5" />
        </MenuButton>

        <MenuItems
          transition
          className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 ring-1 shadow-lg ring-black/5 transition focus:outline-none data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
        >
          <MenuItem>
            <button
              type="button"
              onClick={() => setRenameOpen(true)}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900"
            >
              <PencilIcon className="size-4" />
              Rename
            </button>
          </MenuItem>
          <MenuItem>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 data-focus:bg-red-50 data-focus:text-red-700"
            >
              <TrashIcon className="size-4" />
              Delete
            </button>
          </MenuItem>
        </MenuItems>
      </Menu>

      <RenameWishlistDialog
        wishlist={wishlist}
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
      />
      <DeleteWishlistDialog
        wishlist={wishlist}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={onDeleted}
      />
    </>
  );
}
```

3. Add `RenameWishlistDialog` component:

```tsx
function RenameWishlistDialog({
  wishlist,
  open,
  onClose,
}: {
  wishlist: Wishlist;
  open: boolean;
  onClose: () => void;
}) {
  const { showNotification } = useNotification();
  const [state, formAction, isPending] = useActionState<
    WishlistActionResult,
    FormData
  >(async (prev, formData) => {
    formData.set("wishlist_id", wishlist.id);
    const result = await renameWishlist(prev, formData);
    if (result?.success) {
      onClose();
      showNotification("success", "Wishlist renamed");
    } else if (result?.error) {
      showNotification("error", "Could not rename wishlist", result.error);
    }
    return result;
  }, null);

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative w-full transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <DialogTitle as="h3" className="text-base font-semibold text-gray-900">
              Rename Wishlist
            </DialogTitle>
            <form action={formAction} className="mt-4">
              <label htmlFor="rename-wishlist" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                id="rename-wishlist"
                name="name"
                type="text"
                required
                defaultValue={wishlist.name || ""}
                className="mt-1 block w-full rounded-md bg-white px-3 py-2 text-sm text-gray-900 ring-1 shadow-sm ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600 focus:outline-none"
              />
              {state?.error && (
                <p className="mt-2 text-sm text-red-600">{state.error}</p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 shadow-sm ring-gray-300 ring-inset hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={clsx(
                    "rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                    isPending && "cursor-not-allowed opacity-50",
                  )}
                >
                  {isPending ? "Renaming..." : "Rename"}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
```

4. Add `DeleteWishlistDialog` component:

```tsx
function DeleteWishlistDialog({
  wishlist,
  open,
  onClose,
  onDeleted,
}: {
  wishlist: Wishlist;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("wishlist_id", wishlist.id);
      const result = await deleteWishlist(null, formData);
      if (result?.error) {
        showNotification("error", "Could not delete wishlist", result.error);
      } else {
        showNotification("success", "Wishlist deleted");
        onClose();
        onDeleted();
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative w-full transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <DialogTitle as="h3" className="text-base font-semibold text-gray-900">
              Delete Wishlist
            </DialogTitle>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete &ldquo;{wishlist.name || "this wishlist"}&rdquo;? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 shadow-sm ring-gray-300 ring-inset hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className={clsx(
                  "rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500",
                  isPending && "cursor-not-allowed opacity-50",
                )}
              >
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
```

5. Update the header section of `WishlistPageClient` to include the actions menu. Change the actions `<div>` (around line 79):

```tsx
<div className="flex items-center gap-3">
  <WishlistActionsMenu
    wishlist={activeWishlist!}
    onDeleted={() => setActiveTab(0)}
  />
  <ShareButton wishlistId={activeWishlist!.id} />
  <NewWishlistButton />
</div>
```

When a wishlist is deleted, `onDeleted` resets the active tab to 0 (first wishlist). If it was the last wishlist, the page will show the empty state.

**Step 2: Verify manually**

- Visit `/account/wishlist` with at least one wishlist
- Click the ellipsis (⋮) icon — dropdown should appear with Rename and Delete
- Click Rename — dialog appears pre-filled with current name, rename works
- Click Delete — confirmation dialog appears, delete works and switches to first tab

**Step 3: Commit**

```bash
git add storefront/components/wishlist/wishlist-page-client.tsx
git commit -m "feat: add rename and delete wishlist UI with confirmation dialogs"
```

---

### Task 4: Social Proof Count

Show "X people saved this" on product detail pages. Requires a new backend store route and storefront components.

**Files:**
- Create: `backend/src/api/store/products/[id]/wishlist-count/route.ts`
- Modify: `storefront/lib/medusa/wishlist.ts` (add `getProductWishlistCount()`)
- Create: `storefront/components/wishlist/wishlist-count.tsx`
- Modify: `storefront/components/product/product-detail.tsx` (render `WishlistCount`)
- Modify: `storefront/components/product/product-wrapper.tsx` (pass productId)
- Modify: `storefront/components/product/product-page-content.tsx` (pass productId)

**Step 1: Create the backend store route**

Create `backend/src/api/store/products/[id]/wishlist-count/route.ts`:

```ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"
import type WishlistModuleService from "../../../../../modules/wishlist/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const query = req.scope.resolve("query")
  const wishlistService: WishlistModuleService =
    req.scope.resolve(WISHLIST_MODULE)

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: ["variants.*"],
    filters: { id },
  })

  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
  }

  const count = await wishlistService.getWishlistsOfVariants(
    product.variants.map((v: { id: string }) => v.id)
  )

  res.json({ count })
}
```

This is identical to the admin route logic — just lives under the store path without admin auth.

**Step 2: Add `getProductWishlistCount()` server action**

Add to `storefront/lib/medusa/wishlist.ts` after `getWishlistItemCount()`:

```tsx
export async function getProductWishlistCount(
  productId: string,
): Promise<number> {
  try {
    const result = await sdk.client.fetch<{ count: number }>(
      `/store/products/${productId}/wishlist-count`,
      { method: "GET" },
    );
    return result.count;
  } catch {
    return 0;
  }
}
```

Note: This endpoint doesn't require auth — it's public data.

**Step 3: Create the WishlistCount component**

Create `storefront/components/wishlist/wishlist-count.tsx`:

```tsx
"use client";

import { HeartIcon } from "@heroicons/react/20/solid";
import { useEffect, useState } from "react";
import { getProductWishlistCount } from "lib/medusa/wishlist";

export function WishlistCount({ productId }: { productId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    getProductWishlistCount(productId).then(setCount);
  }, [productId]);

  if (count === 0) return null;

  return (
    <p className="mt-2 flex items-center gap-1 text-sm text-gray-500">
      <HeartIcon className="size-4 text-red-400" />
      {count} {count === 1 ? "person" : "people"} saved this
    </p>
  );
}
```

We use a client component with `useEffect` because the PDP page is cached (`"use cache"`). The count fetches after mount via the server action.

**Step 4: Add WishlistCount to the PDP**

Modify `storefront/components/product/product-detail.tsx`:

1. Add import:

```tsx
import { WishlistCount } from "components/wishlist/wishlist-count";
```

2. Add `productId` to `ProductDetailProps`:

```tsx
interface ProductDetailProps {
  product: TailwindProductDetail;
  sourceProduct: Product;
  options: ProductOption[];
  variants: ProductVariant[];
}
```

No change needed — `sourceProduct.id` already available.

3. Render `WishlistCount` after the reviews section (around line 233, after the reviews `</div>`):

```tsx
{/* Social proof */}
<WishlistCount productId={sourceProduct.id} />
```

Place it right after the reviews stars div (line 233) and before the description div (line 235).

**Step 5: Verify manually**

- Start both backend and storefront: `bun run dev` from root
- Visit a product page that has been wishlisted
- "X people saved this" should appear below the star ratings
- If no one has saved it, nothing shows

**Step 6: Commit**

```bash
git add backend/src/api/store/products/[id]/wishlist-count/route.ts storefront/lib/medusa/wishlist.ts storefront/components/wishlist/wishlist-count.tsx storefront/components/product/product-detail.tsx
git commit -m "feat: add social proof wishlist count on product pages"
```

---

### Task 5: Update TODO.md

**Files:**
- Modify: `TODO.md`

Mark the 4 Phase 2 items as completed:

```markdown
- [x] Nav badge — heart icon in header with item count
- [x] Heart button server state — product cards/PDP hearts reflect current wishlist state
- [x] Rename/delete wishlist UI — actions dropdown with rename dialog and delete confirmation
- [x] Store product wishlist count route — social proof ("X people saved this") on PDP
```

**Commit:**

```bash
git add TODO.md
git commit -m "docs: mark wishlist phase 2 polish items as completed"
```
