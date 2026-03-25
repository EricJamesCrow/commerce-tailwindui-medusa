"use client";

import type { HttpTypes } from "@medusajs/types";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useRef, useState } from "react";

import { SavedPaymentMethods } from "components/checkout/saved-payment-methods";
import { STRIPE_PROVIDER_ID } from "lib/constants";
import {
  getPaymentClientSecret,
  initializePaymentSession,
} from "lib/medusa/checkout";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY)
  : null;

type CheckoutPaymentProps = {
  cart: HttpTypes.StoreCart;
  customer: HttpTypes.StoreCustomer | null;
  onComplete: () => void;
  onStripeReady: (stripe: Stripe, elements: StripeElements) => void;
  savedMethodId: string | null;
  onSavedMethodChange: (methodId: string | null) => void;
};

// ---------------------------------------------------------------------------
// Inner component — has access to useStripe() / useElements()
// ---------------------------------------------------------------------------

function PaymentForm({
  cart,
  customer,
  onComplete,
  onStripeReady,
  savedMethodId,
  onSavedMethodChange,
}: CheckoutPaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usingSavedMethod = savedMethodId !== null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!stripe || !elements) return;

    setError(null);
    setIsSubmitting(true);

    try {
      if (usingSavedMethod) {
        // Saved method — payment session already initialized server-side.
        // Pass stripe/elements refs so the review step can confirm.
        onStripeReady(stripe, elements);
        onComplete();
        return;
      }

      // submit() validates and tokenizes but does NOT confirm payment
      const { error: submitError } = await elements.submit();

      if (submitError) {
        setError(submitError.message || "Payment validation failed.");
        return;
      }

      // Pass refs up so the review step can confirm later
      onStripeReady(stripe, elements);
      onComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const paymentSession = cart.payment_collection?.payment_sessions?.[0] ?? null;

  return (
    <form onSubmit={handleSubmit} className="py-4">
      {/* Saved payment methods for authenticated customers */}
      {customer && paymentSession && (
        <SavedPaymentMethods
          cart={cart}
          paymentSession={paymentSession}
          selectedMethodId={savedMethodId}
          onSelectedMethodChange={onSavedMethodChange}
          onMethodChange={() => {
            // After re-init with saved method, the Elements context
            // may need to refresh. The parent will re-extract clientSecret.
          }}
        />
      )}

      <PaymentElement
        options={{ layout: "accordion" }}
        onChange={(event) => setIsComplete(event.complete)}
      />

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6">
        <button
          type="submit"
          disabled={
            !stripe ||
            !elements ||
            (!isComplete && !usingSavedMethod) ||
            isSubmitting
          }
          className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 w-full rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
        >
          {isSubmitting ? "Processing..." : "Continue to review"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Outer component — handles session init + clientSecret fetching
// ---------------------------------------------------------------------------

export function CheckoutPayment({
  cart,
  customer,
  onComplete,
  onStripeReady,
}: Omit<CheckoutPaymentProps, "savedMethodId" | "onSavedMethodChange">) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMethodId, setSavedMethodId] = useState<string | null>(null);
  const initRef = useRef(false);

  // Zero-total cart: skip Stripe entirely
  const isZeroTotal = cart.total === 0;

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        if (isZeroTotal) {
          // Zero-total: use system default provider
          const result = await initializePaymentSession(
            cart.id,
            "pp_system_default",
          );
          if (result !== null) {
            setError(result);
          } else {
            onComplete();
          }
          return;
        }

        // Initialize Stripe payment session
        const data = customer
          ? { setup_future_usage: "off_session" }
          : undefined;
        const result = await initializePaymentSession(
          cart.id,
          STRIPE_PROVIDER_ID,
          data,
        );

        if (result !== null) {
          setError(result);
          return;
        }

        // Fetch only the client_secret via a dedicated server action —
        // it is never included in the cart RSC payload.
        const secret = await getPaymentClientSecret(cart.id);
        if (secret) {
          setClientSecret(secret);
        }
        // If secret is not yet available, the useEffect below will pick it
        // up after revalidation triggers a re-render with the updated cart.
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to initialize payment session.",
        );
      } finally {
        setIsInitializing(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.id]);

  // Re-fetch clientSecret when payment session changes (e.g. after payment method switch).
  // Guards on initRef so it only fires after the initial session is created.
  const paymentSessionId =
    cart.payment_collection?.payment_sessions?.[0]?.id ?? null;
  useEffect(() => {
    if (isZeroTotal || !initRef.current) return;

    getPaymentClientSecret(cart.id)
      .then((secret) => {
        if (secret && secret !== clientSecret) {
          setClientSecret(secret);
        }
      })
      .catch(() => {
        // Secret refresh failure is non-fatal; initial session secret is still valid.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentSessionId, isZeroTotal]);

  // --- Zero-total rendering ---
  if (isZeroTotal) {
    if (error) {
      return (
        <div className="py-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      );
    }

    return (
      <div className="py-4">
        <p className="text-sm text-gray-700">
          No payment required for this order.
        </p>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="py-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  // --- Loading / waiting for clientSecret ---
  if (isInitializing || !clientSecret) {
    return (
      <div className="space-y-4 py-4">
        <div className="animate-pulse rounded-lg border border-gray-200 p-6">
          <div className="space-y-3">
            <div className="h-4 w-48 rounded bg-gray-200" />
            <div className="h-10 w-full rounded bg-gray-200" />
            <div className="flex gap-3">
              <div className="h-10 w-1/2 rounded bg-gray-200" />
              <div className="h-10 w-1/2 rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Stripe Elements wrapper ---
  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret }}
      key={clientSecret}
    >
      <PaymentForm
        cart={cart}
        customer={customer}
        onComplete={onComplete}
        onStripeReady={onStripeReady}
        savedMethodId={savedMethodId}
        onSavedMethodChange={setSavedMethodId}
      />
    </Elements>
  );
}
