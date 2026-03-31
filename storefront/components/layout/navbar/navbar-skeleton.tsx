"use client";

import { Bars3Icon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

export function NavbarSkeleton() {
  // Even in skeleton, we can have a functional hamburger button
  const [, setIsOpen] = useState(false);

  return (
    <div className="bg-white">
      <header className="relative bg-white">
        <nav
          aria-label="Top"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        >
          <div className="border-b border-gray-200">
            <div className="flex h-16 items-center justify-between">
              {/* Mobile menu button - FUNCTIONAL even while loading */}
              <div className="relative z-50 flex flex-1 items-center lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsOpen(true)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setIsOpen(true);
                  }}
                  className="relative z-10 -ml-2 min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation rounded-md bg-white p-2 text-gray-400 active:bg-gray-100"
                  aria-label="Open main menu"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <span className="sr-only">Open menu</span>
                  <Bars3Icon aria-hidden="true" className="size-6" />
                </button>
                <button
                  type="button"
                  className="ml-2 cursor-pointer rounded-md p-2 text-gray-400"
                  aria-label="Search"
                >
                  <span className="sr-only">Search</span>
                  <MagnifyingGlassIcon aria-hidden="true" className="size-6" />
                </button>
              </div>

              {/* Desktop menu skeleton */}
              <div className="hidden lg:flex lg:flex-1 lg:space-x-8">
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-14 animate-pulse rounded bg-gray-200" />
              </div>

              {/* Logo skeleton */}
              <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />

              {/* Right icons skeleton */}
              <div className="flex flex-1 items-center justify-end space-x-4">
                <div className="hidden h-6 w-6 animate-pulse rounded bg-gray-200 lg:block" />
                <div className="h-6 w-6 animate-pulse rounded bg-gray-200" />
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-6 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            </div>
          </div>
        </nav>
      </header>
    </div>
  );
}
