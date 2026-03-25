"use client";

import type { HttpTypes } from "@medusajs/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AddressForm, EMPTY_ADDRESS } from "components/checkout/address-form";
import { SavedAddressPicker } from "components/checkout/saved-address-picker";
import { getCustomerAddresses, setCartAddresses } from "lib/medusa/checkout";
import type { AddressPayload } from "lib/types";

type CheckoutAddressProps = {
  cart: HttpTypes.StoreCart;
  customer: HttpTypes.StoreCustomer | null;
  onComplete: () => void;
};

function cartShippingToPayload(
  addr: HttpTypes.StoreCartAddress | null | undefined,
): AddressPayload | undefined {
  if (!addr?.address_1) return undefined;
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

function isAddressComplete(addr: AddressPayload): boolean {
  return !!(
    addr.first_name &&
    addr.last_name &&
    addr.address_1 &&
    addr.city &&
    addr.country_code &&
    addr.postal_code
  );
}

export function CheckoutAddress({
  cart,
  customer,
  onComplete,
}: CheckoutAddressProps) {
  const [savedAddresses, setSavedAddresses] = useState<
    HttpTypes.StoreCustomerAddress[]
  >([]);
  const [shippingAddress, setShippingAddress] = useState<AddressPayload>(
    cartShippingToPayload(cart.shipping_address) ?? { ...EMPTY_ADDRESS },
  );
  const [billingAddress, setBillingAddress] = useState<AddressPayload>(
    cartShippingToPayload(cart.billing_address) ?? { ...EMPTY_ADDRESS },
  );
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [useSavedAddress, setUseSavedAddress] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fetchedRef = useRef(false);

  const countries = useMemo(
    (): { iso_2: string; display_name: string }[] =>
      cart.region?.countries?.map((c) => ({
        iso_2: c.iso_2 ?? "",
        display_name: c.display_name ?? c.name ?? c.iso_2?.toUpperCase() ?? "",
      })) ?? [],
    [cart.region?.countries],
  );

  // Fetch saved addresses for authenticated customers
  useEffect(() => {
    if (customer && !fetchedRef.current) {
      fetchedRef.current = true;
      getCustomerAddresses().then((addrs) => {
        setSavedAddresses(addrs);
        if (addrs.length === 0) {
          setUseSavedAddress(false);
        }
      });
    }
  }, [customer]);

  const handleSavedAddressSelect = useCallback(
    (addr: AddressPayload | null) => {
      if (addr === null) {
        // "Use a different address" selected
        setUseSavedAddress(false);
        setShippingAddress({ ...EMPTY_ADDRESS });
      } else {
        setUseSavedAddress(true);
        setShippingAddress(addr);
      }
    },
    [],
  );

  function handleShippingChange(addr: AddressPayload): void {
    setShippingAddress(addr);
  }

  function handleBillingChange(addr: AddressPayload): void {
    setBillingAddress(addr);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isAddressComplete(shippingAddress)) {
      setError("Please fill in all required shipping address fields.");
      return;
    }

    if (!billingSameAsShipping && !isAddressComplete(billingAddress)) {
      setError("Please fill in all required billing address fields.");
      return;
    }

    setIsSubmitting(true);

    const billing = billingSameAsShipping ? undefined : billingAddress;
    try {
      const result = await setCartAddresses(cart.id, shippingAddress, billing);
      if (result === null) {
        onComplete();
      } else {
        setError(result);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const showSavedPicker = customer && savedAddresses.length > 0;
  const showNewForm = !customer || !useSavedAddress;

  return (
    <form onSubmit={handleSubmit} className="py-4">
      {/* Saved address picker (authenticated customers with addresses) */}
      {showSavedPicker && (
        <div className="mb-6">
          <SavedAddressPicker
            addresses={savedAddresses}
            onSelect={handleSavedAddressSelect}
          />
        </div>
      )}

      {/* New address form (guests or "use different address") */}
      {showNewForm && (
        <div className="mb-6">
          {showSavedPicker && (
            <h4 className="mb-3 text-sm/6 font-semibold text-gray-900">
              New shipping address
            </h4>
          )}
          <AddressForm
            key={useSavedAddress ? "saved" : "new"}
            defaultValues={shippingAddress}
            countries={countries}
            onChange={handleShippingChange}
            idPrefix="shipping"
          />
        </div>
      )}

      {/* Billing address toggle */}
      <div className="mb-6">
        <label className="flex items-center gap-x-3">
          <input
            type="checkbox"
            checked={billingSameAsShipping}
            onChange={(e) => setBillingSameAsShipping(e.target.checked)}
            className="text-primary-600 focus:ring-primary-600 h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">
            Billing address same as shipping
          </span>
        </label>
      </div>

      {/* Billing address form (shown when unchecked) */}
      {!billingSameAsShipping && (
        <div className="mb-6">
          <h4 className="mb-3 text-sm/6 font-semibold text-gray-900">
            Billing address
          </h4>
          <AddressForm
            key="billing"
            defaultValues={billingAddress}
            countries={countries}
            onChange={handleBillingChange}
            idPrefix="billing"
          />
        </div>
      )}

      {/* Error */}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 w-full rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
      >
        {isSubmitting ? "Processing..." : "Continue"}
      </button>
    </form>
  );
}
