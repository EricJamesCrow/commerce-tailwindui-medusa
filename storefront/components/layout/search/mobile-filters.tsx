"use client";

import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { FunnelIcon } from "@heroicons/react/20/solid";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { trackClient } from "lib/analytics";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function MobileFilters({
  collections,
}: {
  collections: Array<{ name: string; href: string }>;
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const pathname = usePathname();

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
                  const isActive = pathname === collection.href;
                  return (
                    <li key={collection.name}>
                      <Link
                        href={collection.href}
                        className={`block px-2 py-3 ${isActive ? "underline underline-offset-4" : ""}`}
                      >
                        {collection.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
