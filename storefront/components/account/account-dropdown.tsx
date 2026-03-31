"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  UserIcon,
  ClipboardDocumentListIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { signout } from "lib/medusa/customer";
import Link from "next/link";

function getInitials(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

type AccountDropdownProps = {
  firstName?: string | null;
  lastName?: string | null;
};

export function AccountDropdown({ firstName, lastName }: AccountDropdownProps) {
  return (
    <Menu as="div" className="relative">
      <MenuButton className="bg-primary-100 text-primary-700 hover:bg-primary-200 focus-visible:outline-primary-600 flex cursor-pointer items-center rounded-full text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        <span className="sr-only">Open user menu</span>
        <span className="inline-flex size-8 items-center justify-center rounded-full">
          {getInitials(firstName, lastName)}
        </span>
      </MenuButton>

      <MenuItems
        transition
        className="absolute right-0 z-50 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 transition focus:outline-none data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
      >
        <div className="py-1">
          <MenuItem>
            <Link
              href="/account"
              className="group flex items-center px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900"
            >
              <UserIcon className="mr-3 size-5 text-gray-400 group-data-focus:text-gray-500" />
              My Account
            </Link>
          </MenuItem>
          <MenuItem>
            <Link
              href="/account/orders"
              className="group flex items-center px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900"
            >
              <ClipboardDocumentListIcon className="mr-3 size-5 text-gray-400 group-data-focus:text-gray-500" />
              Order History
            </Link>
          </MenuItem>
        </div>
        <div className="py-1">
          <MenuItem>
            <form action={signout}>
              <button
                type="submit"
                className="group flex w-full cursor-pointer items-center px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900"
              >
                <ArrowRightStartOnRectangleIcon className="mr-3 size-5 text-gray-400 group-data-focus:text-gray-500" />
                Sign out
              </button>
            </form>
          </MenuItem>
        </div>
      </MenuItems>
    </Menu>
  );
}
