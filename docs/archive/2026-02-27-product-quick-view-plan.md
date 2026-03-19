# Product Quick View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Quick View modal to product grid cards so users can see product details, select options, add to cart, and toggle wishlist without navigating to the product page.

**Architecture:** A self-contained client component (`ProductQuickView`) renders a Headless UI Dialog with product info, color/size pickers, add-to-cart via `addItem` server action, and a `WishlistButton`. The existing server-component `ProductGrid` delegates card rendering to a new `ProductCardWithQuickView` client wrapper that manages modal open/close state and shows a "Quick View" button overlay on hover.

**Tech Stack:** React 19, Headless UI (Dialog), Next.js Image, `addItem` server action, `WishlistButton`, `clsx`, `@heroicons/react`

---

### Task 1: Export `getColorHex` from `lib/utils.ts`

The `getColorHex` function is currently private. The quick view modal needs it to render color swatches.

**Files:**
- Modify: `storefront/lib/utils.ts:110`

**Step 1: Export `getColorHex`**

In `storefront/lib/utils.ts`, change line 110 from:

```typescript
const getColorHex = (colorName: string): string => {
```

to:

```typescript
export const getColorHex = (colorName: string): string => {
```

**Step 2: Verify no build errors**

Run: `cd storefront && bunx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing ones are fine)

**Step 3: Commit**

```bash
git add storefront/lib/utils.ts
git commit -m "refactor: export getColorHex for reuse in quick view

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create `ProductQuickView` client component

The modal dialog itself. Based on the TailwindPlus Quick View component, adapted to use real product data, `addItem` server action, and `WishlistButton`.

**Files:**
- Create: `storefront/components/product/product-quick-view.tsx`

**Step 1: Create the component**

Create `storefront/components/product/product-quick-view.tsx` with the following code:

```tsx
"use client";

import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { StarIcon } from "@heroicons/react/20/solid";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { addItem } from "components/cart/actions";
import { useCart } from "components/cart/cart-context";
import ProductGridPrice from "components/price/product-grid-price";
import { WishlistButton } from "components/wishlist/wishlist-button";
import type { Product, ProductVariant } from "lib/types";
import { getColorHex } from "lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

type WishlistState = {
  isInWishlist?: boolean;
  wishlistId?: string;
  wishlistItemId?: string;
};

interface ProductQuickViewProps {
  product: Product;
  wishlistState?: WishlistState;
  open: boolean;
  onClose: () => void;
}

export function ProductQuickView({
  product,
  wishlistState,
  open,
  onClose,
}: ProductQuickViewProps) {
  const { addCartItem } = useCart();
  const [message, formAction] = useActionState(addItem, null);

  // Local variant selection state
  const colorOption = product.options.find(
    (o) => o.name.toLowerCase() === "color",
  );
  const sizeOption = product.options.find(
    (o) => o.name.toLowerCase() === "size",
  );

  const [selectedColor, setSelectedColor] = useState<string>(
    colorOption?.values[0] ?? "",
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    sizeOption?.values[0] ?? "",
  );

  // Derive selected variant from local state
  const selectedVariant = product.variants.find((variant) =>
    variant.selectedOptions.every((opt) => {
      const key = opt.name.toLowerCase();
      if (key === "color") return opt.value === selectedColor;
      if (key === "size") return opt.value === selectedSize;
      return true;
    }),
  );
  const defaultVariantId =
    product.variants.length === 1 ? product.variants[0]?.id : undefined;
  const selectedVariantId = selectedVariant?.id ?? defaultVariantId ?? "";

  const addItemAction = formAction.bind(null, selectedVariantId);

  // Check variant availability
  const isVariantAvailable = (optionName: string, value: string): boolean => {
    const testState: Record<string, string> = {};
    if (optionName === "color") {
      testState["color"] = value;
      if (selectedSize) testState["size"] = selectedSize;
    } else if (optionName === "size") {
      testState["size"] = value;
      if (selectedColor) testState["color"] = selectedColor;
    }

    return product.variants.some(
      (variant) =>
        variant.availableForSale &&
        variant.selectedOptions.every((opt) => {
          const key = opt.name.toLowerCase();
          return !testState[key] || testState[key] === opt.value;
        }),
    );
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 hidden bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in md:block"
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-stretch justify-center text-center md:items-center md:px-2 lg:px-4">
          <DialogPanel
            transition
            className="flex w-full transform text-left text-base transition data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in md:my-8 md:max-w-2xl md:px-4 data-[closed]:md:translate-y-0 data-[closed]:md:scale-95 lg:max-w-4xl"
          >
            <div className="relative flex w-full items-center overflow-hidden bg-white px-4 pb-8 pt-14 shadow-2xl sm:px-6 sm:pt-8 md:p-6 lg:p-8">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-500 sm:right-6 sm:top-8 md:right-6 md:top-6 lg:right-8 lg:top-8"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>

              <div className="grid w-full grid-cols-1 items-start gap-x-6 gap-y-8 sm:grid-cols-12 lg:gap-x-8">
                <div className="sm:col-span-4 lg:col-span-5">
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
                    <Image
                      alt={
                        product.featuredImage?.altText || product.title
                      }
                      src={
                        product.featuredImage?.url ||
                        "https://via.placeholder.com/400"
                      }
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                </div>
                <div className="sm:col-span-8 lg:col-span-7">
                  <h2 className="text-2xl font-bold text-gray-900 sm:pr-12">
                    {product.title}
                  </h2>

                  <section aria-labelledby="information-heading" className="mt-3">
                    <h3 id="information-heading" className="sr-only">
                      Product information
                    </h3>

                    <ProductGridPrice
                      amount={product.priceRange.maxVariantPrice.amount}
                      currencyCode={
                        product.priceRange.maxVariantPrice.currencyCode
                      }
                    />

                    {/* Reviews */}
                    <div className="mt-3">
                      <h4 className="sr-only">Reviews</h4>
                      <div className="flex items-center">
                        <div className="flex items-center">
                          {[0, 1, 2, 3, 4].map((rating) => (
                            <StarIcon
                              key={rating}
                              aria-hidden="true"
                              className={clsx(
                                "size-5 shrink-0",
                                "text-gray-200",
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="sr-only">Description</h4>
                      <p className="text-sm text-gray-700">
                        {product.description}
                      </p>
                    </div>
                  </section>

                  <section aria-labelledby="options-heading" className="mt-6">
                    <h3 id="options-heading" className="sr-only">
                      Product options
                    </h3>

                    <form
                      action={async () => {
                        const variant = product.variants.find(
                          (v) => v.id === selectedVariantId,
                        );
                        if (!variant) return;
                        addCartItem(variant, product);
                        addItemAction();
                        onClose();
                      }}
                    >
                      {/* Colors */}
                      {colorOption && colorOption.values.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-600">
                            Color
                          </h4>

                          <fieldset
                            aria-label="Choose a color"
                            className="mt-2"
                          >
                            <div className="flex items-center gap-x-3">
                              {colorOption.values.map((colorName) => {
                                const hex = getColorHex(colorName);
                                const isSelected = selectedColor === colorName;
                                const isAvailable = isVariantAvailable(
                                  "color",
                                  colorName,
                                );
                                return (
                                  <div
                                    key={colorName}
                                    className={clsx(
                                      "flex rounded-full outline outline-1 -outline-offset-1 outline-black/10",
                                      !isAvailable && "opacity-40",
                                    )}
                                  >
                                    <input
                                      value={colorName}
                                      checked={isSelected}
                                      onChange={() =>
                                        setSelectedColor(colorName)
                                      }
                                      disabled={!isAvailable}
                                      name="color"
                                      type="radio"
                                      aria-label={colorName}
                                      className="size-8 cursor-pointer appearance-none rounded-full checked:outline checked:outline-2 checked:outline-offset-2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] disabled:cursor-not-allowed"
                                      style={{
                                        backgroundColor: hex,
                                        outlineColor: isSelected ? hex : undefined,
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </fieldset>
                        </div>
                      )}

                      {/* Sizes */}
                      {sizeOption && sizeOption.values.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-600">
                            Size
                          </h4>

                          <fieldset
                            aria-label="Choose a size"
                            className="mt-2"
                          >
                            <div className="flex items-center gap-x-3">
                              {sizeOption.values.map((size) => {
                                const isSelected = selectedSize === size;
                                const isAvailable = isVariantAvailable(
                                  "size",
                                  size,
                                );
                                return (
                                  <label
                                    key={size}
                                    className={clsx(
                                      "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium",
                                      isSelected
                                        ? "border-primary-600 bg-primary-600 text-white"
                                        : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
                                      !isAvailable &&
                                        "cursor-not-allowed opacity-40",
                                    )}
                                  >
                                    <input
                                      value={size}
                                      checked={isSelected}
                                      onChange={() => setSelectedSize(size)}
                                      disabled={!isAvailable}
                                      name="size"
                                      type="radio"
                                      className="sr-only"
                                    />
                                    {size}
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        </div>
                      )}

                      <div className="mt-6 flex items-center gap-x-3">
                        <button
                          type="submit"
                          disabled={
                            !product.availableForSale || !selectedVariantId
                          }
                          className="flex flex-1 items-center justify-center rounded-md border border-transparent bg-primary-600 px-8 py-3 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {product.availableForSale
                            ? "Add to cart"
                            : "Out of stock"}
                        </button>
                        <WishlistButton
                          variantId={selectedVariantId}
                          isInWishlist={wishlistState?.isInWishlist}
                          wishlistId={wishlistState?.wishlistId}
                          wishlistItemId={wishlistState?.wishlistItemId}
                          size="md"
                        />
                      </div>

                      <p className="absolute left-4 top-4 text-center sm:static sm:mt-6">
                        <Link
                          href={`/product/${product.handle}`}
                          className="font-medium text-primary-600 hover:text-primary-500"
                          onClick={onClose}
                        >
                          View full details
                        </Link>
                      </p>
                    </form>
                  </section>
                </div>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>

      <p aria-live="polite" className="sr-only" role="status">
        {message}
      </p>
    </Dialog>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd storefront && bunx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 3: Commit**

```bash
git add storefront/components/product/product-quick-view.tsx
git commit -m "feat: add ProductQuickView modal component

TailwindPlus-based quick view dialog with color/size pickers,
add-to-cart action, wishlist heart, and view full details link.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Create `ProductCardWithQuickView` client wrapper

Wraps each product card with the hover overlay "Quick View" button and manages modal state.

**Files:**
- Create: `storefront/components/product/product-card-with-quick-view.tsx`

**Step 1: Create the wrapper component**

Create `storefront/components/product/product-card-with-quick-view.tsx`:

```tsx
"use client";

import ProductGridPrice from "components/price/product-grid-price";
import { ProductQuickView } from "components/product/product-quick-view";
import { WishlistButton } from "components/wishlist/wishlist-button";
import type { Product } from "lib/types";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type WishlistState = {
  isInWishlist?: boolean;
  wishlistId?: string;
  wishlistItemId?: string;
};

interface ProductCardWithQuickViewProps {
  product: Product;
  wishlistState?: WishlistState;
}

export function ProductCardWithQuickView({
  product,
  wishlistState,
}: ProductCardWithQuickViewProps) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const variantId = product.variants?.[0]?.id ?? "";

  return (
    <div className="group animate-fadeIn">
      <div className="relative">
        <Link href={`/product/${product.handle}`} prefetch={true}>
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

        {/* Quick View overlay button */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setQuickViewOpen(true)}
            className="pointer-events-auto cursor-pointer rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-gray-900 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-200 hover:bg-white group-hover:opacity-100"
          >
            Quick View
          </button>
        </div>

        {/* Wishlist heart button */}
        {variantId && (
          <div className="absolute right-2 top-2 z-10">
            <WishlistButton
              variantId={variantId}
              isInWishlist={wishlistState?.isInWishlist}
              wishlistId={wishlistState?.wishlistId}
              wishlistItemId={wishlistState?.wishlistItemId}
              size="sm"
              className="bg-white/80 shadow-sm backdrop-blur-sm hover:bg-white"
            />
          </div>
        )}
      </div>

      <Link href={`/product/${product.handle}`} prefetch={true}>
        <h3 className="mt-4 text-sm text-gray-700">{product.title}</h3>
        <ProductGridPrice
          amount={product.priceRange.maxVariantPrice.amount}
          currencyCode={product.priceRange.maxVariantPrice.currencyCode}
        />
      </Link>

      {/* Quick View modal */}
      <ProductQuickView
        product={product}
        wishlistState={wishlistState}
        open={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
      />
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd storefront && bunx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 3: Commit**

```bash
git add storefront/components/product/product-card-with-quick-view.tsx
git commit -m "feat: add ProductCardWithQuickView with hover overlay button

Client wrapper for product grid cards. Shows Quick View button on
hover over the product image, manages modal open/close state.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Update `ProductGrid` to use `ProductCardWithQuickView`

Replace the inline card rendering in the server component with the new client wrapper.

**Files:**
- Modify: `storefront/components/layout/product-grid.tsx`

**Step 1: Rewrite `ProductGrid` to delegate to the client wrapper**

Replace the entire contents of `storefront/components/layout/product-grid.tsx` with:

```tsx
import { ProductCardWithQuickView } from "components/product/product-card-with-quick-view";
import { getVariantsWishlistStates } from "lib/medusa/wishlist";
import { Product } from "lib/types";

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
          <ProductCardWithQuickView
            key={product.id}
            product={product}
            wishlistState={wlState}
          />
        );
      })}
    </div>
  );
}
```

**Key changes:**
- Removed direct imports of `Image`, `Link`, `ProductGridPrice`, `WishlistButton`
- Each product card now delegates to `ProductCardWithQuickView`
- Passes full `Product` object + wishlist state to the client wrapper
- Server component stays a server component (still fetches wishlist states)

**Step 2: Verify TypeScript compiles**

Run: `cd storefront && bunx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

**Step 3: Verify dev server works**

Run: `cd storefront && bun dev` (in separate terminal)
Navigate to `/products` — verify:
- Product grid renders correctly
- Hovering over a product image shows "Quick View" button
- Clicking "Quick View" opens the modal
- Modal shows product image, title, price, description
- Color swatches work (if product has color variants)
- "Add to cart" button adds item and closes modal
- Wishlist heart in modal toggles correctly
- "View full details" link navigates to PDP
- Heart button on card still works
- Product name/price links still navigate to PDP

**Step 4: Commit**

```bash
git add storefront/components/layout/product-grid.tsx
git commit -m "feat: integrate quick view into product grid

ProductGrid now delegates card rendering to ProductCardWithQuickView.
Quick view is available on all product listing pages (products,
collections, search).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Update TODO.md

**Files:**
- Modify: `storefront/../TODO.md`

**Step 1: Add Quick View to completed items**

Add under the `## Completed` section in `TODO.md`:

```markdown
- [x] Product Quick View modal (hover overlay on product grid, TailwindPlus dialog with color/size pickers, add-to-cart, wishlist heart)
```

**Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: mark product quick view as completed in TODO

Co-Authored-By: Claude <noreply@anthropic.com>"
```
