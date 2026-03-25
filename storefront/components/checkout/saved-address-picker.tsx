"use client";

import type { HttpTypes } from "@medusajs/types";
import clsx from "clsx";
import { useEffect, useState } from "react";

import type { AddressPayload } from "lib/types";

type SavedAddressPickerProps = {
  addresses: HttpTypes.StoreCustomerAddress[];
  onSelect: (address: AddressPayload | null) => void;
};

function toPayload(addr: HttpTypes.StoreCustomerAddress): AddressPayload {
  return {
    first_name: addr.first_name ?? "",
    last_name: addr.last_name ?? "",
    address_1: addr.address_1 ?? "",
    address_2: addr.address_2 ?? undefined,
    company: addr.company ?? undefined,
    city: addr.city ?? "",
    country_code: addr.country_code ?? "",
    province: addr.province ?? undefined,
    postal_code: addr.postal_code ?? "",
    phone: addr.phone ?? undefined,
  };
}

function formatAddress(addr: HttpTypes.StoreCustomerAddress): {
  name: string;
  line: string;
  cityStateZip: string;
  phone: string | null;
} {
  const name = [addr.first_name, addr.last_name].filter(Boolean).join(" ");
  const line = [addr.address_1, addr.address_2].filter(Boolean).join(", ");
  const cityStateZip = [
    addr.city,
    [addr.province, addr.postal_code].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return { name, line, cityStateZip, phone: addr.phone ?? null };
}

export function SavedAddressPicker({
  addresses,
  onSelect,
}: SavedAddressPickerProps) {
  // Default to first address if available, otherwise "new"
  const [selected, setSelected] = useState<string>(
    addresses.length > 0 ? addresses[0]!.id : "new",
  );

  // Sync initial selection to parent state on mount
  useEffect(() => {
    if (addresses.length > 0) {
      onSelect(toPayload(addresses[0]!));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  function handleChange(id: string) {
    setSelected(id);
    if (id === "new") {
      onSelect(null);
    } else {
      const addr = addresses.find((a) => a.id === id);
      if (addr) {
        onSelect(toPayload(addr));
      }
    }
  }

  return (
    <fieldset>
      <legend className="text-sm/6 font-semibold text-gray-900">
        Saved addresses
      </legend>
      <div className="mt-3 space-y-3">
        {addresses.map((addr) => {
          const { name, line, cityStateZip, phone } = formatAddress(addr);
          const isChecked = selected === addr.id;

          return (
            <label
              key={addr.id}
              className={clsx(
                "group relative block cursor-pointer rounded-lg border bg-white px-6 py-4 sm:flex sm:justify-between",
                isChecked
                  ? "outline-primary-600 border-transparent outline outline-2 -outline-offset-2"
                  : "border-gray-300",
              )}
            >
              <input
                type="radio"
                name="saved-address"
                value={addr.id}
                checked={isChecked}
                onChange={() => handleChange(addr.id)}
                className="absolute inset-0 appearance-none focus:outline focus:outline-0"
              />
              <span className="flex items-center">
                <span className="flex flex-col text-sm">
                  <span className="font-medium text-gray-900">{name}</span>
                  <span className="text-gray-500">{line}</span>
                  <span className="text-gray-500">{cityStateZip}</span>
                  {phone && <span className="text-gray-500">{phone}</span>}
                </span>
              </span>
            </label>
          );
        })}

        {/* "Use a different address" option */}
        <label
          className={clsx(
            "group relative block cursor-pointer rounded-lg border bg-white px-6 py-4 sm:flex sm:justify-between",
            selected === "new"
              ? "outline-primary-600 border-transparent outline outline-2 -outline-offset-2"
              : "border-gray-300",
          )}
        >
          <input
            type="radio"
            name="saved-address"
            value="new"
            checked={selected === "new"}
            onChange={() => handleChange("new")}
            className="absolute inset-0 appearance-none focus:outline focus:outline-0"
          />
          <span className="flex items-center">
            <span className="flex flex-col text-sm">
              <span className="font-medium text-gray-900">
                Use a different address
              </span>
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
