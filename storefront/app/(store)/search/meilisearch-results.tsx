"use client"

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react"
import { FunnelIcon, MinusIcon, PlusIcon } from "@heroicons/react/20/solid"
import { XMarkIcon } from "@heroicons/react/24/outline"
import { trackClient } from "lib/analytics"
import {
  MEILISEARCH_INDEX_NAME,
  searchClient,
} from "lib/meilisearch"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import {
  Configure,
  Hits,
  InstantSearch,
  Pagination,
  RefinementList,
  SearchBox,
  SortBy,
  ToggleRefinement,
  useRange,
  useStats,
} from "react-instantsearch"

// --- Price Range Slider ---
function PriceRangeSlider() {
  const { start, range, refine } = useRange({ attribute: "variant_prices" })
  const min = range.min ?? 0
  const max = range.max ?? 100
  const currentMin = start[0] !== -Infinity ? start[0] ?? min : min
  const currentMax = start[1] !== Infinity ? start[1] ?? max : max

  const [localMin, setLocalMin] = useState(currentMin)
  const [localMax, setLocalMax] = useState(currentMax)

  // Sync local state when InstantSearch state changes
  if (localMin !== currentMin || localMax !== currentMax) {
    setLocalMin(currentMin)
    setLocalMax(currentMax)
  }

  return (
    <div className="pt-6">
      <div className="flex items-center gap-4">
        <input
          type="number"
          min={min}
          max={max}
          value={localMin}
          onChange={(e) => setLocalMin(Number(e.target.value))}
          onBlur={() => refine([localMin, localMax])}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
        />
        <span className="text-sm text-gray-500">to</span>
        <input
          type="number"
          min={min}
          max={max}
          value={localMax}
          onChange={(e) => setLocalMax(Number(e.target.value))}
          onBlur={() => refine([localMin, localMax])}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>${min.toFixed(0)}</span>
        <span>${max.toFixed(0)}</span>
      </div>
    </div>
  )
}

// --- Product Hit ---
function ProductHit({ hit }: { hit: Record<string, unknown> }) {
  const handle = hit.handle as string
  const title = hit.title as string
  const thumbnail = hit.thumbnail as string | null
  const prices = (hit.variant_prices as number[]) || []
  const minPrice = prices.length ? Math.min(...prices) : 0
  const availability = hit.availability as boolean

  return (
    <Link href={`/product/${handle}`} className="group text-sm">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
        {thumbnail ? (
          <Image
            alt={title}
            src={thumbnail}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover group-hover:opacity-75"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            No image
          </div>
        )}
      </div>
      <h3 className="mt-4 font-medium text-gray-900">{title}</h3>
      {!availability && (
        <p className="text-gray-500 italic">Out of stock</p>
      )}
      <p className="mt-2 font-medium text-gray-900">
        ${minPrice.toFixed(2)}
      </p>
    </Link>
  )
}

// --- Stats Header ---
function SearchStats({ query }: { query: string }) {
  const { nbHits } = useStats()
  const resultsText = nbHits === 1 ? "result" : "results"

  return (
    <p className="text-sm text-gray-500">
      {nbHits === 0
        ? "No products found for "
        : `Showing ${nbHits} ${resultsText} for `}
      <span className="font-semibold text-gray-900">&quot;{query}&quot;</span>
    </p>
  )
}

// --- Filter Sections (shared between desktop & mobile) ---
function FilterSections() {
  return (
    <>
      {/* Collections */}
      <Disclosure as="div" className="border-b border-gray-200 py-6" defaultOpen>
        <h3 className="-my-3 flow-root">
          <DisclosureButton className="group flex w-full items-center justify-between bg-white py-3 text-sm text-gray-400 hover:text-gray-500">
            <span className="font-medium text-gray-900">Collections</span>
            <span className="ml-6 flex items-center">
              <PlusIcon aria-hidden="true" className="size-5 group-data-[open]:hidden" />
              <MinusIcon aria-hidden="true" className="size-5 group-[:not([data-open])]:hidden" />
            </span>
          </DisclosureButton>
        </h3>
        <DisclosurePanel className="pt-6">
          <RefinementList
            attribute="collection_titles"
            classNames={{
              list: "space-y-4",
              item: "flex gap-3",
              checkbox:
                "size-4 appearance-none rounded border border-gray-300 bg-white checked:border-primary-600 checked:bg-primary-600",
              label: "flex items-center gap-3 text-sm text-gray-600 cursor-pointer",
              count: "ml-auto text-xs text-gray-400",
            }}
          />
        </DisclosurePanel>
      </Disclosure>

      {/* Price Range */}
      <Disclosure as="div" className="border-b border-gray-200 py-6" defaultOpen>
        <h3 className="-my-3 flow-root">
          <DisclosureButton className="group flex w-full items-center justify-between bg-white py-3 text-sm text-gray-400 hover:text-gray-500">
            <span className="font-medium text-gray-900">Price Range</span>
            <span className="ml-6 flex items-center">
              <PlusIcon aria-hidden="true" className="size-5 group-data-[open]:hidden" />
              <MinusIcon aria-hidden="true" className="size-5 group-[:not([data-open])]:hidden" />
            </span>
          </DisclosureButton>
        </h3>
        <DisclosurePanel>
          <PriceRangeSlider />
        </DisclosurePanel>
      </Disclosure>

      {/* Availability */}
      <Disclosure as="div" className="border-b border-gray-200 py-6" defaultOpen>
        <h3 className="-my-3 flow-root">
          <DisclosureButton className="group flex w-full items-center justify-between bg-white py-3 text-sm text-gray-400 hover:text-gray-500">
            <span className="font-medium text-gray-900">Availability</span>
            <span className="ml-6 flex items-center">
              <PlusIcon aria-hidden="true" className="size-5 group-data-[open]:hidden" />
              <MinusIcon aria-hidden="true" className="size-5 group-[:not([data-open])]:hidden" />
            </span>
          </DisclosureButton>
        </h3>
        <DisclosurePanel className="pt-6">
          <ToggleRefinement
            attribute="availability"
            label="In stock only"
            classNames={{
              checkbox:
                "size-4 appearance-none rounded border border-gray-300 bg-white checked:border-primary-600 checked:bg-primary-600",
              label: "flex items-center gap-3 text-sm text-gray-600 cursor-pointer",
            }}
          />
        </DisclosurePanel>
      </Disclosure>
    </>
  )
}

// --- Main Component ---
export default function MeilisearchResults({
  initialQuery,
  initialCollection,
}: {
  initialQuery: string
  initialCollection?: string
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  if (!searchClient) return null

  const sortItems = [
    { value: MEILISEARCH_INDEX_NAME, label: "Relevance" },
    { value: `${MEILISEARCH_INDEX_NAME}:title:asc`, label: "Name: A to Z" },
    { value: `${MEILISEARCH_INDEX_NAME}:title:desc`, label: "Name: Z to A" },
    { value: `${MEILISEARCH_INDEX_NAME}:variant_prices:asc`, label: "Price: Low to High" },
    { value: `${MEILISEARCH_INDEX_NAME}:variant_prices:desc`, label: "Price: High to Low" },
    { value: `${MEILISEARCH_INDEX_NAME}:created_at:desc`, label: "Newest" },
  ]

  return (
    <InstantSearch
      searchClient={searchClient}
      indexName={MEILISEARCH_INDEX_NAME}
      initialUiState={{
        [MEILISEARCH_INDEX_NAME]: {
          query: initialQuery,
          ...(initialCollection
            ? {
                refinementList: {
                  collection_titles: [initialCollection],
                },
              }
            : {}),
        },
      }}
    >
      {/* Hidden search box — pre-populated from URL, syncs state */}
      <div className="hidden">
        <SearchBox />
      </div>
      <Configure filters="status = published" hitsPerPage={24} />

      {/* Mobile filter dialog */}
      <Dialog
        open={mobileFiltersOpen}
        onClose={setMobileFiltersOpen}
        className="relative z-40 lg:hidden"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/25 transition-opacity duration-300 ease-linear data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 z-40 flex">
          <DialogPanel
            transition
            className="relative ml-auto flex size-full max-w-xs transform flex-col overflow-y-auto bg-white pt-4 pb-6 shadow-xl transition duration-300 ease-in-out data-[closed]:translate-x-full"
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
            <div className="mt-4 border-t border-gray-200 px-4">
              <FilterSections />
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Header: stats + sort + mobile filter trigger */}
      <div className="flex items-center justify-between pb-4">
        <SearchStats query={initialQuery} />
        <div className="flex items-center gap-2">
          <SortBy
            items={sortItems}
            classNames={{
              select:
                "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-hidden",
            }}
          />
          <button
            type="button"
            onClick={() => {
              setMobileFiltersOpen(true)
              trackClient("mobile_filters_opened", {})
            }}
            className="-m-2 ml-2 p-2 text-gray-400 hover:text-gray-500 lg:hidden"
          >
            <span className="sr-only">Filters</span>
            <FunnelIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      {/* Desktop: sidebar + grid */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">
        {/* Desktop filters */}
        <div className="hidden lg:block">
          <FilterSections />
        </div>

        {/* Product grid + pagination */}
        <div className="lg:col-span-3">
          <Hits
            hitComponent={ProductHit}
            classNames={{
              list: "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8",
            }}
          />
          <div className="mt-8 flex justify-center">
            <Pagination
              classNames={{
                list: "flex gap-1",
                item: "rounded-md px-3 py-1.5 text-sm",
                selectedItem: "bg-primary-600 text-white",
                disabledItem: "text-gray-300 cursor-not-allowed",
              }}
            />
          </div>
        </div>
      </div>
    </InstantSearch>
  )
}
