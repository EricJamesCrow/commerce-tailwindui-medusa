"use client";

import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { FunnelIcon } from "@heroicons/react/20/solid";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { FormEvent } from "react";
import clsx from "clsx";
import { redactPiiFromQuery, trackClient } from "lib/analytics";
import { MEILISEARCH_ENABLED } from "lib/meilisearch";
import { createUrl } from "lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

export function MobileFilters({
  collections,
}: {
  collections: Array<{ name: string; handle: string }>;
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const selectedCollection = searchParams.get("collection") || "";
  const availability = searchParams.get("availability");
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const sort = searchParams.get("sort");
  const isSearchPage = pathname === "/search" && MEILISEARCH_ENABLED && !!query;
  const hasFacetFilters =
    !!selectedCollection ||
    availability === "in_stock" ||
    !!minPrice ||
    !!maxPrice;

  const buildSearchHref = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(overrides)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    return createUrl("/search", params);
  };

  return (
    <>
      {/* Mobile filter button */}
      <button
        type="button"
        onClick={() => {
          setMobileFiltersOpen(true);
          trackClient("mobile_filters_opened", {});
        }}
        className="-m-2 ml-4 p-2 text-gray-400 hover:text-gray-500 sm:ml-6 lg:hidden"
      >
        <span className="sr-only">Filters</span>
        <FunnelIcon aria-hidden="true" className="size-5" />
      </button>

      {/* Mobile filter dialog */}
      <Dialog
        open={mobileFiltersOpen}
        onClose={setMobileFiltersOpen}
        className="relative z-40 lg:hidden"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/25 transition-opacity duration-300 ease-linear data-closed:opacity-0"
        />

        <div className="fixed inset-0 z-40 flex">
          <DialogPanel
            transition
            className="relative ml-auto flex size-full max-w-xs transform flex-col overflow-y-auto bg-white pt-4 pb-6 shadow-xl transition duration-300 ease-in-out data-closed:translate-x-full"
          >
            <div className="flex items-center justify-between px-4">
              <h2 className="text-lg font-medium text-gray-900">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="focus-visible:ring-primary-500 relative -mr-2 flex size-10 items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2"
              >
                <span className="absolute -inset-0.5" />
                <span className="sr-only">Close menu</span>
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>
            </div>

            {/* Mobile Collections */}
            <div className="mt-4 border-t border-gray-200">
              <h3 className="sr-only">Collections</h3>
              <ul role="list" className="px-2 py-3 font-medium text-gray-900">
                {collections.map((collection) => {
                  const href = isSearchPage
                    ? buildSearchHref({
                        collection: collection.handle || null,
                      })
                    : collection.handle
                      ? `/products/${collection.handle}`
                      : "/products";
                  const isActive = isSearchPage
                    ? selectedCollection === collection.handle
                    : pathname === href;

                  return (
                    <li key={collection.name}>
                      <Link
                        href={href}
                        onClick={() => {
                          setMobileFiltersOpen(false);
                          if (!isSearchPage) {
                            return;
                          }

                          trackClient("search_facet_applied", {
                            facet_type: "collection",
                            facet_value: collection.handle || "all",
                            query: redactPiiFromQuery(query),
                          });
                        }}
                        className={clsx(
                          "block px-2 py-3",
                          isActive && "underline underline-offset-4",
                        )}
                      >
                        {collection.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {isSearchPage ? (
              <>
                <div className="border-t border-gray-200 px-4 py-5">
                  <h3 className="text-sm font-medium text-gray-900">
                    Availability
                  </h3>
                  <div className="mt-4">
                    <Link
                      href={buildSearchHref({
                        availability:
                          availability === "in_stock" ? null : "in_stock",
                      })}
                      onClick={() => {
                        setMobileFiltersOpen(false);
                        trackClient("search_facet_applied", {
                          facet_type: "availability",
                          facet_value:
                            availability === "in_stock" ? "all" : "in_stock",
                          query: redactPiiFromQuery(query),
                        });
                      }}
                      className={clsx(
                        "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors",
                        availability === "in_stock"
                          ? "border-primary-600 bg-primary-50 text-primary-700"
                          : "border-gray-300 text-gray-700",
                      )}
                    >
                      In stock only
                    </Link>
                  </div>
                </div>

                <div className="border-t border-gray-200 px-4 py-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">
                      Price range
                    </h3>
                    {minPrice || maxPrice ? (
                      <Link
                        href={buildSearchHref({
                          minPrice: null,
                          maxPrice: null,
                        })}
                        onClick={() => setMobileFiltersOpen(false)}
                        className="text-sm text-gray-500 underline underline-offset-4"
                      >
                        Clear
                      </Link>
                    ) : null}
                  </div>

                  <form
                    action="/search"
                    className="mt-4 space-y-3"
                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                      const formData = new FormData(event.currentTarget);
                      const submittedMin =
                        formData.get("minPrice")?.toString() || "0";
                      const submittedMax =
                        formData.get("maxPrice")?.toString() || "any";

                      setMobileFiltersOpen(false);
                      trackClient("search_facet_applied", {
                        facet_type: "price_range",
                        facet_value: `${submittedMin}-${submittedMax}`,
                        query: redactPiiFromQuery(query),
                      });
                    }}
                  >
                    <input type="hidden" name="q" value={query} />
                    {sort ? (
                      <input type="hidden" name="sort" value={sort} />
                    ) : null}
                    {selectedCollection ? (
                      <input
                        type="hidden"
                        name="collection"
                        value={selectedCollection}
                      />
                    ) : null}
                    {availability === "in_stock" ? (
                      <input
                        type="hidden"
                        name="availability"
                        value="in_stock"
                      />
                    ) : null}

                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-sm text-gray-700">
                        <span className="mb-1 block">Min</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          name="minPrice"
                          defaultValue={minPrice}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                      </label>

                      <label className="text-sm text-gray-700">
                        <span className="mb-1 block">Max</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          name="maxPrice"
                          defaultValue={maxPrice}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="bg-primary-600 text-primary-50 hover:bg-primary-700 inline-flex items-center rounded-md px-3 py-2 text-sm font-medium"
                    >
                      Apply price
                    </button>
                  </form>
                </div>

                {hasFacetFilters ? (
                  <div className="border-t border-gray-200 px-4 py-5">
                    <Link
                      href={buildSearchHref({
                        availability: null,
                        collection: null,
                        maxPrice: null,
                        minPrice: null,
                      })}
                      onClick={() => setMobileFiltersOpen(false)}
                      className="text-sm text-gray-500 underline underline-offset-4"
                    >
                      Clear all filters
                    </Link>
                  </div>
                ) : null}
              </>
            ) : null}
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
