"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from "@headlessui/react";
import {
  Bars3Icon,
  HeartIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AccountDropdown } from "components/account/account-dropdown";
import { Cart } from "components/cart";
import { SearchButton } from "components/search-command";
import { trackClient } from "lib/analytics";
import { signout } from "lib/medusa/customer";
import { Navigation } from "lib/types";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { NavbarDesktop } from "./navbar-desktop";

type CustomerData = {
  firstName: string | null;
  lastName: string | null;
};

type NavbarClientProps = {
  navigation: Navigation;
  customer: CustomerData | null;
  wishlistCount: number;
};

export function NavbarClient({
  navigation,
  customer,
  wishlistCount,
}: NavbarClientProps) {
  const [open, setOpen] = useState(false);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Auto-close menu on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname, searchParams]);

  // Auto-close menu on resize to desktop
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024) {
        setOpen(false);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleClose(value: boolean) {
    setOpen(value);
    if (!value) {
      setTimeout(() => {
        hamburgerButtonRef.current?.focus();
      }, 100);
    }
  }

  return (
    <div className="bg-white">
      {/* Mobile menu - inlined from navbar-mobile */}
      <Dialog
        open={open}
        onClose={handleClose}
        className="relative z-50 lg:hidden"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/25 transition-opacity duration-300 ease-linear data-closed:opacity-0"
        />
        <div className="fixed inset-0 z-50 flex">
          <DialogPanel
            id="mobile-menu"
            transition
            className="relative flex w-full max-w-xs transform flex-col overflow-y-auto bg-white pb-12 shadow-xl transition duration-300 ease-in-out data-closed:-translate-x-full"
          >
            <div className="flex px-4 pt-5 pb-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="focus-visible:outline-primary-600 relative -m-2 inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 focus-visible:outline-2"
                aria-label="Close menu"
                data-testid="close-mobile-menu"
              >
                <span className="absolute -inset-0.5" />
                <span className="sr-only">Close menu</span>
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>
            </div>

            {/* Links */}
            <TabGroup className="mt-2">
              <div className="border-b border-gray-200">
                <TabList className="-mb-px flex space-x-8 px-4">
                  {navigation.categories.map((category) => (
                    <Tab
                      key={category.name}
                      className="data-selected:border-primary-600 data-selected:text-primary-600 flex-1 border-b-2 border-transparent px-1 py-4 text-base font-medium whitespace-nowrap text-gray-900"
                    >
                      {category.name}
                    </Tab>
                  ))}
                </TabList>
              </div>
              <TabPanels>
                {navigation.categories.map((category, categoryIdx) => (
                  <TabPanel
                    key={category.name}
                    className="space-y-12 px-4 pt-10 pb-6"
                  >
                    <div className="grid grid-cols-1 items-start gap-x-6 gap-y-10">
                      <div className="grid grid-cols-1 gap-x-6 gap-y-10">
                        <div>
                          <p
                            id={`mobile-featured-heading-${categoryIdx}`}
                            className="font-medium text-gray-900"
                          >
                            Featured
                          </p>
                          <ul
                            role="list"
                            aria-labelledby={`mobile-featured-heading-${categoryIdx}`}
                            className="mt-6 space-y-6"
                          >
                            {category.featured.map((item) => (
                              <li key={item.name} className="flex">
                                <Link
                                  prefetch={true}
                                  href={item.href}
                                  className="text-gray-500"
                                >
                                  {item.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p
                            id="mobile-categories-heading"
                            className="font-medium text-gray-900"
                          >
                            Categories
                          </p>
                          <ul
                            role="list"
                            aria-labelledby="mobile-categories-heading"
                            className="mt-6 space-y-6"
                          >
                            {category.categories.map((item) => (
                              <li key={item.name} className="flex">
                                <Link
                                  prefetch={true}
                                  href={item.href}
                                  className="text-gray-500"
                                >
                                  {item.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-x-6 gap-y-10">
                        <div>
                          <p
                            id="mobile-collection-heading"
                            className="font-medium text-gray-900"
                          >
                            Collection
                          </p>
                          <ul
                            role="list"
                            aria-labelledby="mobile-collection-heading"
                            className="mt-6 space-y-6"
                          >
                            {category.collection.map((item) => (
                              <li key={item.name} className="flex">
                                <Link
                                  prefetch={true}
                                  href={item.href}
                                  className="text-gray-500"
                                >
                                  {item.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p
                            id="mobile-brand-heading"
                            className="font-medium text-gray-900"
                          >
                            Brands
                          </p>
                          <ul
                            role="list"
                            aria-labelledby="mobile-brand-heading"
                            className="mt-6 space-y-6"
                          >
                            {category.brands.map((item) => (
                              <li key={item.name} className="flex">
                                <Link
                                  prefetch={true}
                                  href={item.href}
                                  className="text-gray-500"
                                >
                                  {item.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </TabPanel>
                ))}
              </TabPanels>
            </TabGroup>

            <div className="space-y-6 border-t border-gray-200 px-4 py-6">
              {navigation.pages.map((page) => (
                <div key={page.name} className="flow-root">
                  <Link
                    prefetch={true}
                    href={page.href}
                    className="-m-2 block p-2 font-medium text-gray-900"
                  >
                    {page.name}
                  </Link>
                </div>
              ))}
            </div>

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
                    <Link
                      href="/account/wishlist"
                      className="-m-2 block p-2 font-medium text-gray-900"
                    >
                      Wishlist
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
          </DialogPanel>
        </div>
      </Dialog>

      <header className="relative bg-white">
        <nav
          aria-label="Top"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        >
          <div className="border-b border-gray-200">
            <div className="flex h-16 items-center justify-between">
              <div className="relative z-50 flex flex-1 items-center lg:hidden">
                <button
                  ref={hamburgerButtonRef}
                  type="button"
                  onClick={() => {
                    setOpen(true);
                    trackClient("mobile_menu_opened", {});
                  }}
                  className="focus-visible:outline-primary-600 relative z-10 -ml-2 min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation rounded-md bg-white p-2 text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 active:bg-gray-100"
                  aria-expanded={open}
                  aria-controls="mobile-menu"
                  aria-label="Open main menu"
                  data-testid="hamburger"
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                  }}
                >
                  <span className="sr-only">Open menu</span>
                  <Bars3Icon aria-hidden="true" className="size-6" />
                </button>

                <SearchButton className="focus-visible:outline-primary-600 ml-2 rounded-md p-2 text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2" />
              </div>

              {/* Flyout menus */}
              <NavbarDesktop navigation={navigation} />

              {/* Logo */}
              <Link prefetch={true} href="/" className="flex">
                <span className="sr-only">Your Company</span>
                <Image
                  alt=""
                  src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
                  width={32}
                  height={32}
                  className="h-8 w-auto"
                />
              </Link>

              <div className="flex flex-1 items-center justify-end">
                {/* Search */}
                <SearchButton className="focus-visible:outline-primary-600 hidden rounded-md p-2 text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 lg:block" />

                {/* Account */}
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
                </div>

                {/* Wishlist */}
                <div className="ml-4 flow-root lg:ml-6">
                  <Link
                    href="/account/wishlist"
                    aria-label={
                      wishlistCount > 0
                        ? `Wishlist, ${wishlistCount} item${wishlistCount === 1 ? "" : "s"}`
                        : "Wishlist"
                    }
                    className="group -m-2 flex items-center rounded-md p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                  >
                    <HeartIcon
                      aria-hidden="true"
                      className="size-6 shrink-0 text-gray-400 group-hover:text-gray-500"
                    />
                    {wishlistCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="ml-2 text-sm font-medium text-gray-700 group-hover:text-gray-800"
                      >
                        {wishlistCount}
                      </span>
                    )}
                  </Link>
                </div>

                {/* Cart */}
                <div className="ml-4 flow-root lg:ml-6">
                  <Suspense fallback={null}>
                    <Cart />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </header>
    </div>
  );
}
