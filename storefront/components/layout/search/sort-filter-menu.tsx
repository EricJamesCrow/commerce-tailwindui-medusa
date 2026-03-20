"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { trackClient } from "lib/analytics";
import { sorting } from "lib/constants";
import { createUrl } from "lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function SortFilterMenu() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get("sort");
  const q = searchParams.get("q");

  const sortOptions = sorting.map((item) => {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    if (item.slug) {
      params.set("sort", item.slug);
    } else {
      params.delete("sort");
    }

    const href = createUrl(pathname, params);

    return {
      name: item.title,
      slug: item.slug || "default",
      href,
      current: currentSort === item.slug || (!currentSort && !item.slug),
    };
  });

  return (
    <Menu as="div" className="relative inline-block text-left">
      <MenuButton className="group inline-flex justify-center text-sm font-medium text-gray-700 hover:text-gray-900">
        Sort
        <ChevronDownIcon
          aria-hidden="true"
          className="-mr-1 ml-1 size-5 shrink-0 text-gray-400 group-hover:text-gray-500"
        />
      </MenuButton>

      <MenuItems
        transition
        className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-white shadow-2xl ring-1 ring-black/5 transition focus:outline-hidden data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
      >
        <div className="py-1">
          {sortOptions.map((option) => (
            <MenuItem key={option.name}>
              <Link
                href={option.href}
                onClick={() =>
                  trackClient("sort_option_selected", { sort_key: option.slug })
                }
                className={clsx(
                  option.current
                    ? "font-medium text-gray-900"
                    : "text-gray-500",
                  "data-focus:bg-primary-50 block px-4 py-2 text-sm data-focus:outline-hidden",
                )}
              >
                {option.name}
              </Link>
            </MenuItem>
          ))}
        </div>
      </MenuItems>
    </Menu>
  );
}
