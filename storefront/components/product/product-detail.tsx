"use client";

import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from "@headlessui/react";
import { StarIcon } from "@heroicons/react/20/solid";
import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { AddToCart } from "components/cart/add-to-cart";
import Breadcrumbs from "components/layout/breadcrumbs";
import ProductDetailPrice from "components/price/product-detail-price";
import { useProduct, useUpdateURL } from "components/product/product-context";
import { WishlistButton } from "components/wishlist/wishlist-button";
import { WishlistCount } from "components/wishlist/wishlist-count";
import clsx from "clsx";
import { trackClient } from "lib/analytics";
import { sanitizeHtml } from "lib/sanitize";
import type { Product, ProductOption, ProductVariant } from "lib/types";
import type { TailwindProductDetail } from "lib/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Combination = {
  id: string;
  availableForSale: boolean;
  [key: string]: string | boolean;
};

interface ProductDetailProps {
  product: TailwindProductDetail;
  sourceProduct: Product;
  options: ProductOption[];
  variants: ProductVariant[];
}

export function ProductDetail({
  product,
  sourceProduct,
  options,
  variants,
}: ProductDetailProps) {
  const { state, updateOption: updateOptionContext } = useProduct();
  const updateURL = useUpdateURL();
  const router = useRouter();

  const combinations: Combination[] = variants.map((variant) => ({
    id: variant.id,
    availableForSale: variant.availableForSale,
    ...variant.selectedOptions.reduce(
      (acc, option) => ({ ...acc, [option.name.toLowerCase()]: option.value }),
      {} as Record<string, string>,
    ),
  }));

  const optionExists = (key: string, value: string) =>
    options.find(
      (o) => o.name.toLowerCase() === key && o.values.includes(value),
    );

  const isAvailable = (key: string, value: string) => {
    const optionParams = { ...state, [key]: value };
    const filtered = Object.entries(optionParams).filter(([k, v]) =>
      optionExists(k, String(v)),
    );
    const match = combinations.find((combination) =>
      filtered.every(
        ([k, v]) => combination[k] === v && combination.availableForSale,
      ),
    );
    return Boolean(match);
  };

  const pushParam = (key: string, value: string) => {
    const newState = updateOptionContext(key, value);
    updateURL(newState);
  };

  const getColorClasses = (value: string) => {
    const color = product.colors.find(
      (c) => c.name.toLowerCase() === value.toLowerCase(),
    );
    return color?.classes || "bg-gray-200";
  };

  // Extract hex color from Tailwind arbitrary class like bg-[#111827]
  const getColorHexFromValue = (value: string): string => {
    const classes = getColorClasses(value);
    const match = classes.match(/bg-\[(#[^\]]+)\]/);
    return match?.[1] ?? "#9CA3AF";
  };

  const colorOption = options.find((o) => o.name.toLowerCase() === "color");
  const sizeOption = options.find((o) => o.name.toLowerCase() === "size");

  // Derive the currently selected variant ID from option state
  const selectedVariant = combinations.find((combo) =>
    Object.entries(state).every(([key, value]) => combo[key] === value),
  );
  const selectedVariantId = selectedVariant?.id ?? variants[0]?.id ?? "";

  // Select sensible defaults on first render (prefer available variant)
  useEffect(() => {
    const optionKeys = options.map((o) => o.name.toLowerCase());
    const missingKeys = optionKeys.filter((k) => !state[k]);
    if (missingKeys.length === 0) return;

    // Filter variants by currently selected state (partial match)
    const partiallyMatched = variants.filter((v) =>
      v.selectedOptions.every((opt) => {
        const key = opt.name.toLowerCase();
        return !state[key] || state[key] === opt.value;
      }),
    );

    const preferred =
      partiallyMatched.find((v) => v.availableForSale) ||
      partiallyMatched[0] ||
      variants.find((v) => v.availableForSale) ||
      variants[0];

    if (!preferred) return;

    preferred.selectedOptions.forEach((opt) => {
      const key = opt.name.toLowerCase();
      if (!state[key]) {
        const newState = updateOptionContext(key, opt.value);
        updateURL(newState);
      }
    });
  }, [options, variants, state]);

  return (
    <main className="mx-auto max-w-7xl sm:px-6 sm:pt-12 lg:px-8">
      <div className="mx-auto max-w-2xl lg:max-w-none">
        <div className="px-4 pt-6 pb-4 sm:px-0 sm:pt-0 sm:pb-6 lg:pb-8">
          <Breadcrumbs
            items={[
              { name: "Home", href: "/" },
              { name: "Products", href: "/products" },
              { name: product.name },
            ]}
          />
        </div>
        {/* Product */}
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
          {/* Image gallery */}
          <TabGroup
            className="flex flex-col-reverse"
            onChange={(index) =>
              trackClient("product_image_viewed", {
                product_id: sourceProduct.id,
                image_index: index,
              })
            }
          >
            {/* Image selector */}
            <div className="mx-auto mt-6 hidden w-full max-w-2xl sm:block lg:max-w-none">
              <TabList className="grid grid-cols-4 gap-6">
                {product.images.map((image) => (
                  <Tab
                    key={image.id}
                    className="group focus-visible:ring-primary-500/50 relative flex h-24 cursor-pointer items-center justify-center rounded-md bg-white text-sm font-medium text-gray-900 uppercase hover:bg-gray-50 focus:outline-hidden focus-visible:ring-3 focus-visible:ring-offset-4"
                  >
                    <span className="sr-only">{image.name}</span>
                    <span className="absolute inset-0 overflow-hidden rounded-md">
                      <Image
                        alt={image.name || ""}
                        src={image.src}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </span>
                    <span
                      aria-hidden="true"
                      className="group-data-selected:ring-primary-500 pointer-events-none absolute inset-0 rounded-md ring-2 ring-transparent ring-offset-2"
                    />
                  </Tab>
                ))}
              </TabList>
            </div>

            <TabPanels>
              {product.images.map((image) => (
                <TabPanel key={image.id}>
                  <div className="relative aspect-square w-full overflow-hidden sm:rounded-lg">
                    <Image
                      alt={image.alt}
                      src={image.src}
                      fill
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                </TabPanel>
              ))}
            </TabPanels>
          </TabGroup>

          {/* Product info */}
          <div className="mt-10 px-4 sm:mt-16 sm:px-0 lg:mt-0">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {product.name}
            </h1>

            <div className="mt-3">
              <h2 className="sr-only">Product information</h2>
              <ProductDetailPrice
                amount={product.priceAmount}
                currencyCode={product.priceCurrency}
              />
            </div>

            {/* Reviews */}
            <div className="mt-3">
              <h3 className="sr-only">Reviews</h3>
              <div className="flex items-center">
                <div className="flex items-center">
                  {[0, 1, 2, 3, 4].map((rating) => (
                    <StarIcon
                      key={rating}
                      aria-hidden="true"
                      className={clsx(
                        product.rating > rating
                          ? "text-primary-500"
                          : "text-gray-300",
                        "size-5 shrink-0",
                      )}
                    />
                  ))}
                </div>
                <p className="sr-only">{product.rating} out of 5 stars</p>
              </div>
            </div>

            {/* Social proof */}
            <WishlistCount productId={sourceProduct.id} />

            <div className="mt-6">
              <h3 className="sr-only">Description</h3>

              <div
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(product.description),
                }}
                className="space-y-6 text-base text-gray-700"
              />
            </div>

            {/* Colors */}
            {colorOption && colorOption.values.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900">Color</h3>

                <fieldset aria-label="Choose a color" className="mt-2">
                  <div className="flex items-center gap-x-3">
                    {colorOption.values.map((value) => {
                      const isOptionAvailable = isAvailable("color", value);
                      const isActive = state["color"] === value;
                      const hex = getColorHexFromValue(value);
                      const isWhite = /^#fff(?:fff)?$/i.test(hex);
                      const activeRing = isWhite ? "#4F46E5" : hex; // primary-600 ring for white
                      return (
                        <label
                          key={value}
                          className={clsx(
                            "flex cursor-pointer items-center",
                            !isOptionAvailable
                              ? "cursor-not-allowed opacity-40"
                              : "",
                          )}
                        >
                          <input
                            value={value}
                            checked={Boolean(isActive)}
                            onChange={() => {
                              pushParam("color", value);
                              trackClient("product_variant_selected", {
                                product_id: sourceProduct.id,
                                option_name: "color",
                                option_value: value,
                              });
                            }}
                            name="color"
                            type="radio"
                            aria-label={value}
                            disabled={!isOptionAvailable}
                            className="sr-only"
                          />
                          <span
                            aria-hidden
                            className="inline-block size-8 rounded-full"
                            style={{
                              backgroundColor: hex,
                              boxShadow: isActive
                                ? `0 0 0 2px #fff, 0 0 0 4px ${activeRing}`
                                : "0 0 0 1px rgba(0,0,0,0.1)",
                            }}
                            title={`Color ${value}${!isOptionAvailable ? " (Out of Stock)" : ""}`}
                          />
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}

            {/* Size picker */}
            {sizeOption && sizeOption.values.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-gray-900">Size</h2>
                  {/* <a href="#" className="text-sm font-medium text-primary-600 hover:text-primary-500">
                    See sizing chart
                  </a> */}
                </div>

                <fieldset aria-label="Choose a size" className="mt-2">
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {sizeOption.values.map((value) => {
                      const isOptionAvailable = isAvailable("size", value);
                      const isActive = state["size"] === value;
                      return (
                        <label
                          key={value}
                          aria-label={value}
                          className="group has-checked:border-primary-600 has-checked:bg-primary-600 has-focus-visible:outline-primary-600 relative flex items-center justify-center rounded-md border border-gray-300 bg-white p-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-disabled:border-gray-400 has-disabled:bg-gray-200 has-disabled:opacity-25"
                        >
                          <input
                            value={value}
                            checked={Boolean(isActive)}
                            name="size"
                            type="radio"
                            disabled={!isOptionAvailable}
                            onChange={() => {
                              pushParam("size", value);
                              trackClient("product_variant_selected", {
                                product_id: sourceProduct.id,
                                option_name: "size",
                                option_value: value,
                              });
                            }}
                            className="absolute inset-0 appearance-none focus:outline-none disabled:cursor-not-allowed"
                          />
                          <span className="text-sm font-medium text-gray-900 uppercase group-has-checked:text-white">
                            {value}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}

            <div className="mt-10 flex">
              <AddToCart
                product={sourceProduct}
                formClassName="max-w-xs flex-1"
                className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 flex w-full cursor-pointer items-center justify-center rounded-md border border-transparent px-8 py-3 text-base font-medium text-white focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
              />
              <WishlistButton
                variantId={selectedVariantId}
                productId={sourceProduct.id}
                size="md"
                className="ml-4"
              />
            </div>

            <section aria-labelledby="details-heading" className="mt-12">
              <h2 id="details-heading" className="sr-only">
                Additional details
              </h2>

              <div className="divide-y divide-gray-200 border-t border-gray-200">
                {product.details.map((detail) => (
                  <Disclosure key={detail.name} as="div">
                    <h3>
                      <DisclosureButton
                        className="group relative flex w-full items-center justify-between py-6 text-left"
                        onClick={() =>
                          trackClient("product_details_expanded", {
                            product_id: sourceProduct.id,
                            section_name: detail.name,
                          })
                        }
                      >
                        <span className="group-data-open:text-primary-600 text-sm font-medium text-gray-900">
                          {detail.name}
                        </span>
                        <span className="ml-6 flex items-center">
                          <PlusIcon
                            aria-hidden="true"
                            className="block size-6 text-gray-400 group-hover:text-gray-500 group-data-open:hidden"
                          />
                          <MinusIcon
                            aria-hidden="true"
                            className="text-primary-400 group-hover:text-primary-500 hidden size-6 group-data-open:block"
                          />
                        </span>
                      </DisclosureButton>
                    </h3>
                    <DisclosurePanel className="pb-6">
                      <ul
                        role="list"
                        className="list-disc space-y-1 pl-5 text-sm/6 text-gray-700 marker:text-gray-300"
                      >
                        {detail.items.map((item) => (
                          <li key={item} className="pl-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </DisclosurePanel>
                  </Disclosure>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
