"use client";

import type { HttpTypes } from "@medusajs/types";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { trackClient } from "lib/analytics";
import { getShippingOptions, setShippingMethod } from "lib/medusa/checkout";
import { formatMoney } from "lib/medusa/format";
import type { ShippingOption } from "lib/types";

type CheckoutShippingProps = {
  cart: HttpTypes.StoreCart;
  onComplete: () => void;
};

export function CheckoutShipping({
  cart,
  onComplete,
}: CheckoutShippingProps) {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    cart.shipping_methods?.[0]?.shipping_option_id ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch shipping options on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    getShippingOptions(cart.id)
      .then(async (opts) => {
        setOptions(opts);
        setIsLoading(false);

        if (opts.length === 0) {
          trackClient("checkout_shipping_no_options", {
            has_shipping_address: Boolean(cart.shipping_address),
            has_postal_code: Boolean(cart.shipping_address?.postal_code),
          });
        }

        // Auto-select and submit if there's only one option
        const preselected =
          cart.shipping_methods?.[0]?.shipping_option_id ?? null;
        const autoSelectId =
          opts.length === 1 ? opts[0]!.id : preselected;

        if (autoSelectId && opts.some((o) => o.id === autoSelectId)) {
          setSelectedOptionId(autoSelectId);
          setIsSubmitting(true);
          try {
            const result = await setShippingMethod(cart.id, autoSelectId);
            if (result === null) {
              onComplete();
            } else {
              setError(result);
            }
          } catch {
            // Let user retry manually
          } finally {
            setIsSubmitting(false);
          }
        }
      })
      .catch(() => {
        setError("Failed to load shipping options. Please try again.");
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.id]);

  async function handleSelect(optionId: string) {
    setSelectedOptionId(optionId);
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await setShippingMethod(cart.id, optionId);
      if (result === null) {
        onComplete();
      } else {
        setError(result);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-200 px-6 py-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="h-4 w-16 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // No options available (or fetch failed)
  if (options.length === 0) {
    return (
      <div className="py-4">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-sm text-gray-500">
            No shipping options available for your address.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="py-4">
      <fieldset>
        <legend className="sr-only">Shipping method</legend>
        <div className="space-y-3">
          {options.map((option) => (
            <label
              key={option.id}
              className={clsx(
                "group relative block cursor-pointer rounded-lg border border-gray-300 bg-white px-6 py-4 has-[:checked]:outline has-[:checked]:outline-2 has-[:checked]:-outline-offset-2 has-[:checked]:outline-primary-600 sm:flex sm:justify-between",
                isSubmitting && "pointer-events-none opacity-60",
              )}
            >
              <input
                type="radio"
                name="shipping-option"
                value={option.id}
                checked={selectedOptionId === option.id}
                onChange={() => handleSelect(option.id)}
                onClick={() => {
                  // onChange won't fire if already checked — handle re-click
                  if (selectedOptionId === option.id) {
                    handleSelect(option.id);
                  }
                }}
                className="absolute inset-0 appearance-none focus:outline focus:outline-0"
              />
              <span className="flex items-center">
                <span className="flex flex-col text-sm">
                  <span className="font-medium text-gray-900">
                    {option.name}
                  </span>
                </span>
              </span>
              <span className="mt-2 flex text-sm sm:ml-4 sm:mt-0 sm:flex-col sm:text-right">
                <span className="font-medium text-gray-900">
                  {formatMoney(option.amount, option.currency_code)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Error */}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {/* Submitting indicator */}
      {isSubmitting && (
        <p className="mt-4 text-sm text-gray-500">
          Setting shipping method...
        </p>
      )}
    </div>
  );
}
