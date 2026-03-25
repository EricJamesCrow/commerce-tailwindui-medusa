"use client";

import type { HttpTypes } from "@medusajs/types";
import { setCartEmail } from "lib/medusa/checkout";
import { useEffect, useRef, useState } from "react";

export function CheckoutEmail({
  cart,
  customer,
  onComplete,
}: {
  cart: HttpTypes.StoreCart;
  customer: HttpTypes.StoreCustomer | null;
  onComplete: () => void;
}) {
  const [email, setEmail] = useState(cart.email || customer?.email || "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);

  // If customer is logged in and cart doesn't have email yet, auto-set it
  useEffect(() => {
    if (customer?.email && !cart.email && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      setCartEmail(cart.id, customer.email).then((result) => {
        if (result === null) {
          onComplete();
        } else {
          setError(result);
        }
      });
    }
  }, [customer, cart.email, cart.id, onComplete]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await setCartEmail(cart.id, email);

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

  // If customer is logged in, show a simpler view
  if (customer?.email) {
    return (
      <div className="py-4">
        <p className="text-sm text-gray-700">
          Signed in as{" "}
          <span className="font-medium text-gray-900">{customer.email}</span>
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="py-4">
      <label
        htmlFor="checkout-email"
        className="block text-sm/6 font-medium text-gray-900"
      >
        Email address
      </label>
      <div className="mt-2">
        <input
          id="checkout-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4">
        <button
          type="submit"
          disabled={isSubmitting || !email}
          className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 w-full rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
        >
          {isSubmitting ? "Processing..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
