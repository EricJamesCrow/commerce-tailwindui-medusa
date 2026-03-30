import { Squares2X2Icon } from "@heroicons/react/20/solid";
import Collections from "components/layout/search/collections";
import MobileFiltersWrapper from "components/layout/search/mobile-filters-wrapper";
import { SortFilter } from "components/layout/search/sort-filter";
import { Suspense } from "react";
import ChildrenWrapper from "../shared/children-wrapper";
import SearchHeader from "../shared/search-header";

export default function ListingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-baseline justify-between border-b border-gray-200 pt-24 pb-6">
          <Suspense
            fallback={
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                Products
              </h1>
            }
          >
            <SearchHeader />
          </Suspense>

          <div className="flex items-center">
            <SortFilter />

            <button
              type="button"
              className="-m-2 ml-5 p-2 text-gray-400 hover:text-gray-500 sm:ml-7"
            >
              <span className="sr-only">View grid</span>
              <Squares2X2Icon aria-hidden="true" className="size-5" />
            </button>

            <MobileFiltersWrapper />
          </div>
        </div>

        <section aria-labelledby="products-heading" className="pt-6 pb-24">
          <h2 id="products-heading" className="sr-only">
            Products
          </h2>

          <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">
            <div className="hidden lg:block">
              <Collections />
            </div>

            <div className="lg:col-span-3">
              <Suspense fallback={null}>
                <ChildrenWrapper>{children}</ChildrenWrapper>
              </Suspense>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
