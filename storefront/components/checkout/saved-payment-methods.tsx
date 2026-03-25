"use client";

import type { HttpTypes } from "@medusajs/types";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { STRIPE_PROVIDER_ID } from "lib/constants";
import {
  getSavedPaymentMethods,
  initializePaymentSession,
} from "lib/medusa/checkout";
import type { SavedPaymentMethod } from "lib/types";

type SavedPaymentMethodsProps = {
  cart: HttpTypes.StoreCart;
  paymentSession: HttpTypes.StorePaymentSession;
  selectedMethodId: string | null;
  onSelectedMethodChange: (methodId: string | null) => void;
  onMethodChange: () => void;
};

function formatBrand(brand: string): string {
  const brands: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
    diners: "Diners Club",
    jcb: "JCB",
    unionpay: "UnionPay",
  };
  return (
    brands[brand.toLowerCase()] ||
    brand.charAt(0).toUpperCase() + brand.slice(1)
  );
}

export function SavedPaymentMethods({
  cart,
  paymentSession,
  selectedMethodId,
  onSelectedMethodChange,
  onMethodChange,
}: SavedPaymentMethodsProps) {
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const accountHolderId = (
    paymentSession?.context as { account_holder?: { id: string } } | undefined
  )?.account_holder?.id;

  // Fetch saved payment methods on mount
  useEffect(() => {
    if (fetchedRef.current || !accountHolderId) {
      setIsLoading(false);
      return;
    }
    fetchedRef.current = true;

    getSavedPaymentMethods(accountHolderId)
      .then((methods) => {
        setSavedMethods(methods);
      })
      .catch(() => {
        // Silently fail — user can still use new card
      })
      .finally(() => setIsLoading(false));
  }, [accountHolderId]);

  async function handleSelectSaved(methodId: string) {
    onSelectedMethodChange(methodId);
    setError(null);
    setIsSwitching(true);

    try {
      const result = await initializePaymentSession(
        cart.id,
        STRIPE_PROVIDER_ID,
        { payment_method: methodId },
      );
      if (result !== null) {
        setError(result);
        onSelectedMethodChange(null);
      } else {
        onMethodChange();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to select payment method.",
      );
      onSelectedMethodChange(null);
    } finally {
      setIsSwitching(false);
    }
  }

  async function handleUseNewCard() {
    onSelectedMethodChange(null);
    setError(null);
    setIsSwitching(true);

    try {
      const result = await initializePaymentSession(
        cart.id,
        STRIPE_PROVIDER_ID,
      );
      if (result !== null) {
        setError(result);
      } else {
        onMethodChange();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to switch to new card.",
      );
    } finally {
      setIsSwitching(false);
    }
  }

  // Don't render if no account holder or still loading
  if (!accountHolderId) return null;

  if (isLoading) {
    return (
      <div className="space-y-3 pb-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-200 px-6 py-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded-full bg-gray-200" />
              <div className="h-4 w-40 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (savedMethods.length === 0) return null;

  return (
    <div className="pb-4">
      <p className="mb-3 text-sm font-medium text-gray-900">
        Saved payment methods
      </p>
      <fieldset disabled={isSwitching}>
        <legend className="sr-only">Saved payment methods</legend>
        <div className="space-y-3">
          {savedMethods.map((method) => {
            const { card } = method.data;
            const isSelected = selectedMethodId === method.id;

            return (
              <label
                key={method.id}
                className={clsx(
                  "group has-[:checked]:outline-primary-600 relative block cursor-pointer rounded-lg border border-gray-300 bg-white px-6 py-4 has-[:checked]:outline has-[:checked]:outline-2 has-[:checked]:-outline-offset-2",
                  isSwitching && "pointer-events-none opacity-60",
                )}
              >
                <input
                  type="radio"
                  name="saved-payment-method"
                  value={method.id}
                  checked={isSelected}
                  onChange={() => handleSelectSaved(method.id)}
                  className="absolute inset-0 appearance-none focus:outline focus:outline-0"
                />
                <span className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {formatBrand(card.brand)} &bull;&bull;&bull;&bull;{" "}
                    {card.last4}
                  </span>
                  <span className="text-sm text-gray-500">
                    Expires {String(card.exp_month).padStart(2, "0")}/
                    {card.exp_year}
                  </span>
                </span>
              </label>
            );
          })}

          {/* Use a new card option */}
          <label
            className={clsx(
              "group has-[:checked]:outline-primary-600 relative block cursor-pointer rounded-lg border border-gray-300 bg-white px-6 py-4 has-[:checked]:outline has-[:checked]:outline-2 has-[:checked]:-outline-offset-2",
              isSwitching && "pointer-events-none opacity-60",
            )}
          >
            <input
              type="radio"
              name="saved-payment-method"
              value="new"
              checked={selectedMethodId === null}
              onChange={handleUseNewCard}
              className="absolute inset-0 appearance-none focus:outline focus:outline-0"
            />
            <span className="text-sm font-medium text-gray-900">
              Use a new card
            </span>
          </label>
        </div>
      </fieldset>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {isSwitching && (
        <p className="mt-3 text-sm text-gray-500">
          Switching payment method...
        </p>
      )}
    </div>
  );
}
