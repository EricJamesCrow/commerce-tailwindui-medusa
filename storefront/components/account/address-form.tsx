"use client";

import {
  addCustomerAddress,
  updateCustomerAddress,
  type ActionResult,
} from "lib/medusa/customer";
import type { HttpTypes } from "@medusajs/types";
import { useActionState, useEffect, useRef } from "react";
import { useNotification } from "components/notifications";

type AddressFormProps = {
  address?: HttpTypes.StoreCustomerAddress;
  onClose: () => void;
};

export function AddressForm({ address, onClose }: AddressFormProps) {
  const isEditing = Boolean(address);
  const action = isEditing ? updateCustomerAddress : addCustomerAddress;
  const submitLabel = isEditing ? "Update address" : "Add address";
  const { showNotification } = useNotification();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [result, formAction, isPending] = useActionState<
    ActionResult,
    FormData
  >(action, null);

  const prevResultRef = useRef(result);

  useEffect(() => {
    if (result !== prevResultRef.current) {
      if (result?.success) {
        showNotification(
          "success",
          isEditing ? "Address updated" : "Address added",
        );
        onCloseRef.current();
      }
      prevResultRef.current = result;
    }
  }, [result, showNotification, isEditing]);

  return (
    <form action={formAction} className="space-y-6">
      {result?.error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{result.error}</p>
        </div>
      )}

      {address && <input type="hidden" name="address_id" value={address.id} />}

      <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label
            htmlFor="first_name"
            className="block text-sm/6 font-medium text-gray-900"
          >
            First name
          </label>
          <div className="mt-2">
            <input
              id="first_name"
              type="text"
              name="first_name"
              required
              defaultValue={address?.first_name || ""}
              autoComplete="given-name"
              className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label
            htmlFor="last_name"
            className="block text-sm/6 font-medium text-gray-900"
          >
            Last name
          </label>
          <div className="mt-2">
            <input
              id="last_name"
              type="text"
              name="last_name"
              required
              defaultValue={address?.last_name || ""}
              autoComplete="family-name"
              className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
            />
          </div>
        </div>

        <div className="col-span-full">
          <label
            htmlFor="company"
            className="block text-sm/6 font-medium text-gray-900"
          >
            Company <span className="text-gray-400">(optional)</span>
          </label>
          <div className="mt-2">
            <input
              id="company"
              type="text"
              name="company"
              defaultValue={address?.company || ""}
              autoComplete="organization"
              className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
            />
          </div>
        </div>

        <div className="col-span-full">
          <label
            htmlFor="address_1"
            className="block text-sm/6 font-medium text-gray-900"
          >
            Address line 1
          </label>
          <div className="mt-2">
            <input
              id="address_1"
              type="text"
              name="address_1"
              required
              defaultValue={address?.address_1 || ""}
              autoComplete="address-line1"
              className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
            />
          </div>
        </div>

        <div className="col-span-full">
          <label
            htmlFor="address_2"
            className="block text-sm/6 font-medium text-gray-900"
          >
            Address line 2 <span className="text-gray-400">(optional)</span>
          </label>
          <div className="mt-2">
            <input
              id="address_2"
              type="text"
              name="address_2"
              defaultValue={address?.address_2 || ""}
              autoComplete="address-line2"
              className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
            />
          </div>
        </div>

        <div className="sm:col-span-2 sm:col-start-1">
          <label
            htmlFor="city"
            className="block text-sm/6 font-medium text-gray-900"
          >
            City
          </label>
          <div className="mt-2">
            <input
              id="city"
              type="text"
              name="city"
              required
              defaultValue={address?.city || ""}
              autoComplete="address-level2"
              className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="province"
            className="block text-sm/6 font-medium text-gray-900"
          >
            State / Province
          </label>
          <div className="mt-2">
            <input
              id="province"
              type="text"
              name="province"
              defaultValue={address?.province || ""}
              autoComplete="address-level1"
              className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="postal_code"
            className="block text-sm/6 font-medium text-gray-900"
          >
            ZIP / Postal code
          </label>
          <div className="mt-2">
            <input
              id="postal_code"
              type="text"
              name="postal_code"
              required
              defaultValue={address?.postal_code || ""}
              autoComplete="postal-code"
              className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label
            htmlFor="country_code"
            className="block text-sm/6 font-medium text-gray-900"
          >
            Country
          </label>
          <div className="mt-2">
            <select
              id="country_code"
              name="country_code"
              required
              defaultValue={address?.country_code || "us"}
              autoComplete="country"
              className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 sm:max-w-xs sm:text-sm/6"
            >
              <option value="us">United States</option>
              <option value="ca">Canada</option>
              <option value="gb">United Kingdom</option>
              <option value="au">Australia</option>
              <option value="de">Germany</option>
              <option value="fr">France</option>
              <option value="it">Italy</option>
              <option value="es">Spain</option>
              <option value="nl">Netherlands</option>
              <option value="jp">Japan</option>
              <option value="mx">Mexico</option>
            </select>
          </div>
        </div>

        <div className="sm:col-span-3">
          <label
            htmlFor="phone"
            className="block text-sm/6 font-medium text-gray-900"
          >
            Phone <span className="text-gray-400">(optional)</span>
          </label>
          <div className="mt-2">
            <input
              id="phone"
              type="tel"
              name="phone"
              defaultValue={address?.phone || ""}
              autoComplete="tel"
              className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:max-w-xs sm:text-sm/6"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-x-6">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-sm/6 font-semibold text-gray-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 cursor-pointer rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
