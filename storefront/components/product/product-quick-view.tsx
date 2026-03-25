"use client";

import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { addItem } from "components/cart/actions";
import { useCart } from "components/cart/cart-context";
import ProductGridPrice from "components/price/product-grid-price";
import { WishlistButton } from "components/wishlist/wishlist-button";
import { trackClient } from "lib/analytics";
import type { Product } from "lib/types";
import { getColorHex } from "lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";

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
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

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

  // Derive selected variant from local state (fail-closed for unsupported option dimensions)
  const hasUnsupportedOptions = product.options.some((o) => {
    const name = o.name.toLowerCase();
    return name !== "color" && name !== "size";
  });

  const selectedVariant = hasUnsupportedOptions
    ? undefined
    : product.variants.find((variant) =>
        variant.selectedOptions.every((opt) => {
          const key = opt.name.toLowerCase();
          if (key === "color") return opt.value === selectedColor;
          if (key === "size") return opt.value === selectedSize;
          return false;
        }),
      );
  const defaultVariantId =
    product.variants.length === 1 ? product.variants[0]?.id : undefined;
  const selectedVariantId = selectedVariant?.id ?? defaultVariantId;

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
        className="fixed inset-0 hidden bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[enter]:ease-out data-[leave]:duration-200 data-[leave]:ease-in md:block"
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-stretch justify-center text-center md:items-center md:px-2 lg:px-4">
          <DialogPanel
            transition
            className="flex w-full transform text-left text-base transition data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[enter]:ease-out data-[leave]:duration-200 data-[leave]:ease-in md:my-8 md:max-w-2xl md:px-4 data-[closed]:md:translate-y-0 data-[closed]:md:scale-95 lg:max-w-4xl"
          >
            <div className="relative flex w-full items-center overflow-hidden bg-white px-4 pt-14 pb-8 shadow-2xl sm:px-6 sm:pt-8 md:p-6 lg:p-8">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 sm:top-8 sm:right-6 md:top-6 md:right-6 lg:top-8 lg:right-8"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>

              <div className="grid w-full grid-cols-1 items-start gap-x-6 gap-y-8 sm:grid-cols-12 lg:gap-x-8">
                <div className="sm:col-span-4 lg:col-span-5">
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
                    <Image
                      alt={product.featuredImage?.altText || product.title}
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

                  <section
                    aria-labelledby="information-heading"
                    className="mt-3"
                  >
                    <h3 id="information-heading" className="sr-only">
                      Product information
                    </h3>

                    <ProductGridPrice
                      amount={product.priceRange.maxVariantPrice.amount}
                      currencyCode={
                        product.priceRange.maxVariantPrice.currencyCode
                      }
                    />

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
                      action={() => {
                        if (
                          !selectedVariant ||
                          !selectedVariant.availableForSale
                        ) {
                          setMessage("Selected variant is out of stock");
                          return;
                        }
                        addCartItem(selectedVariant, product);
                        startTransition(async () => {
                          const result = await addItem(
                            null,
                            selectedVariant.id,
                          );
                          if (result) {
                            setMessage(result);
                          } else {
                            setMessage(null);
                            onClose();
                          }
                        });
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
                                      onChange={() => {
                                        setSelectedColor(colorName);
                                        trackClient(
                                          "product_variant_selected",
                                          {
                                            product_id: product.id,
                                            option_name: "color",
                                            option_value: colorName,
                                          },
                                        );
                                      }}
                                      disabled={!isAvailable}
                                      name="color"
                                      type="radio"
                                      aria-label={colorName}
                                      className="size-8 cursor-pointer appearance-none rounded-full checked:outline checked:outline-2 checked:outline-offset-2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] disabled:cursor-not-allowed"
                                      style={{
                                        backgroundColor: hex,
                                        outlineColor: isSelected
                                          ? hex
                                          : undefined,
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

                          <fieldset aria-label="Choose a size" className="mt-2">
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
                                      onChange={() => {
                                        setSelectedSize(size);
                                        trackClient(
                                          "product_variant_selected",
                                          {
                                            product_id: product.id,
                                            option_name: "size",
                                            option_value: size,
                                          },
                                        );
                                      }}
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

                      {message && (
                        <p className="mt-4 text-sm text-red-600">{message}</p>
                      )}

                      <div className="mt-6 flex items-start gap-x-3">
                        <div className="flex-1">
                          <button
                            type="submit"
                            disabled={
                              !selectedVariant?.availableForSale || isPending
                            }
                            className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 flex w-full items-center justify-center rounded-md border border-transparent px-8 py-3 text-base font-medium text-white focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {!selectedVariant?.availableForSale
                              ? "Out of stock"
                              : isPending
                                ? "Adding..."
                                : "Add to cart"}
                          </button>

                          <p className="absolute top-4 left-4 sm:static sm:mt-6 sm:text-center">
                            <Link
                              href={`/product/${product.handle}`}
                              className="text-primary-600 hover:text-primary-500 font-medium"
                              onClick={onClose}
                            >
                              View full details
                            </Link>
                          </p>
                        </div>
                        {selectedVariantId && (
                          <WishlistButton
                            key={selectedVariantId}
                            variantId={selectedVariantId}
                            productId={product.id}
                            isInWishlist={
                              selectedVariantId === product.variants?.[0]?.id
                                ? wishlistState?.isInWishlist
                                : undefined
                            }
                            wishlistId={
                              selectedVariantId === product.variants?.[0]?.id
                                ? wishlistState?.wishlistId
                                : undefined
                            }
                            wishlistItemId={
                              selectedVariantId === product.variants?.[0]?.id
                                ? wishlistState?.wishlistItemId
                                : undefined
                            }
                            size="md"
                          />
                        )}
                      </div>
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
