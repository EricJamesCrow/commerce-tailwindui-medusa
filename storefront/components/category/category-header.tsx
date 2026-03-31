"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDownIcon, Squares2X2Icon } from "@heroicons/react/20/solid";
import type { SortOption } from "./types";

interface CategoryHeaderProps {
  title: string;
  sortOptions: SortOption[];
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function CategoryHeader({
  title,
  sortOptions,
}: CategoryHeaderProps) {
  return (
    <div className="flex items-baseline justify-between border-b border-gray-200 pt-24 pb-6">
      <h1 className="text-4xl font-bold tracking-tight text-gray-900">
        {title}
      </h1>

      <div className="flex items-center">
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
                  <a
                    href={option.href}
                    className={classNames(
                      option.current
                        ? "font-medium text-gray-900"
                        : "text-gray-500",
                      "data-focus:bg-primary-50 block px-4 py-2 text-sm data-focus:outline-hidden",
                    )}
                  >
                    {option.name}
                  </a>
                </MenuItem>
              ))}
            </div>
          </MenuItems>
        </Menu>

        <button
          type="button"
          className="-m-2 ml-5 cursor-pointer p-2 text-gray-400 hover:text-gray-500 sm:ml-7"
        >
          <span className="sr-only">View grid</span>
          <Squares2X2Icon aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  );
}
