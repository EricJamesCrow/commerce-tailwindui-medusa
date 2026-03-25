"use client";

import * as Sentry from "@sentry/nextjs";
import type { HttpTypes } from "@medusajs/types";
import {
  Elements,
  ExpressCheckoutElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type {
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementReadyEvent,
} from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useCallback, useState } from "react";

import { applyExpressCheckoutData, completeCart } from "lib/medusa/checkout";
import type { AddressPayload } from "lib/types";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY)
  : null;

function splitName(fullName: string | undefined): {
  firstName: string;
  lastName: string;
} {
  const parts = (fullName || "").split(" ");
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

// ---------------------------------------------------------------------------
// Inner component — has access to useStripe() / useElements()
// ---------------------------------------------------------------------------

function ExpressCheckoutInner({ cart }: { cart: HttpTypes.StoreCart }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isAvailable, setIsAvailable] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const onReady = useCallback(
    ({ availablePaymentMethods }: StripeExpressCheckoutElementReadyEvent) => {
      if (
        availablePaymentMethods &&
        Object.values(availablePaymentMethods).some(Boolean)
      ) {
        setIsAvailable(true);
      }
    },
    [],
  );

  const onConfirm = useCallback(
    async (event: StripeExpressCheckoutElementConfirmEvent) => {
      if (!stripe || !elements) return;

      try {
        const { billingDetails, shippingAddress } = event;

        const email = billingDetails?.email || cart.email || "";
        if (!email) {
          setOrderError("No email address provided. Please try again.");
          return;
        }
        const shippingName = splitName(
          shippingAddress?.name || billingDetails?.name,
        );
        const billingName = splitName(billingDetails?.name);

        const shippingPayload: AddressPayload = {
          first_name: shippingName.firstName,
          last_name: shippingName.lastName,
          address_1:
            shippingAddress?.address?.line1 ||
            billingDetails?.address?.line1 ||
            "",
          address_2:
            shippingAddress?.address?.line2 ||
            billingDetails?.address?.line2 ||
            undefined,
          city:
            shippingAddress?.address?.city ||
            billingDetails?.address?.city ||
            "",
          country_code: (
            shippingAddress?.address?.country ||
            billingDetails?.address?.country ||
            "US"
          ).toLowerCase(),
          province:
            shippingAddress?.address?.state ||
            billingDetails?.address?.state ||
            undefined,
          postal_code:
            shippingAddress?.address?.postal_code ||
            billingDetails?.address?.postal_code ||
            "",
          phone: billingDetails?.phone || undefined,
        };

        const billingPayload: AddressPayload = {
          first_name: billingName.firstName,
          last_name: billingName.lastName,
          address_1:
            billingDetails?.address?.line1 || shippingPayload.address_1,
          address_2:
            billingDetails?.address?.line2 || shippingPayload.address_2,
          city: billingDetails?.address?.city || shippingPayload.city,
          country_code: (
            billingDetails?.address?.country || "US"
          ).toLowerCase(),
          province: billingDetails?.address?.state || shippingPayload.province,
          postal_code:
            billingDetails?.address?.postal_code || shippingPayload.postal_code,
          phone: billingDetails?.phone || undefined,
        };

        // Chain all Medusa steps: email, addresses, shipping, payment session
        const clientSecret = await applyExpressCheckoutData(
          cart.id,
          email,
          shippingPayload,
          billingPayload,
        );

        // Confirm payment with Stripe
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          clientSecret,
          confirmParams: {
            return_url: `${window.location.origin}/checkout/capture/${cart.id}`,
          },
          redirect: "if_required",
        });

        if (error) {
          Sentry.captureException(error, {
            tags: { action: "express_checkout_payment" },
          });
          console.error(
            "[Express Checkout] Payment confirmation error:",
            error,
          );
          setOrderError(
            error.message || "Payment confirmation failed. Please try again.",
          );
          return;
        }

        // Only complete cart if payment reached a terminal status
        if (
          paymentIntent?.status !== "requires_capture" &&
          paymentIntent?.status !== "succeeded"
        ) {
          setOrderError(
            `Unexpected payment status: ${paymentIntent?.status}. Please try again.`,
          );
          return;
        }

        // Complete the cart
        const result = await completeCart(cart.id);

        if (result.type === "order") {
          window.location.href = `/order/confirmed/${result.order.id}`;
        } else {
          Sentry.captureException(
            new Error(
              result.error || "Express checkout cart completion failed",
            ),
            { tags: { action: "express_checkout_complete" } },
          );
          console.error(
            "[Express Checkout] Cart completion error:",
            result.error,
          );
          setOrderError(
            "Your payment was processed but we couldn't confirm your order. " +
              "Please contact support with your payment reference. " +
              "Do not retry the payment.",
          );
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { action: "express_checkout" } });
        console.error("[Express Checkout] Error:", err);
        setOrderError(
          err instanceof Error ? err.message : "An unexpected error occurred.",
        );
      }
    },
    [stripe, elements, cart.id],
  );

  if (!isAvailable) return null;

  return (
    <div className="mb-10">
      {orderError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{orderError}</p>
        </div>
      )}
      <ExpressCheckoutElement onReady={onReady} onConfirm={onConfirm} />

      {/* "Or" divider */}
      <div className="relative mt-8">
        <div aria-hidden="true" className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-sm font-medium text-gray-500">
            or
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outer component — provides Elements context for ExpressCheckoutElement
// ---------------------------------------------------------------------------

export function ExpressCheckout({ cart }: { cart: HttpTypes.StoreCart }) {
  // Hide if Stripe is not configured or for zero-total carts
  if (!stripePromise || cart.total === 0) return null;

  const amount = Math.round((cart.total ?? 0) * 100);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount: amount > 0 ? amount : 50, // Stripe requires minimum of 50 cents
        currency: (cart.currency_code || "usd").toLowerCase(),
      }}
    >
      <ExpressCheckoutInner cart={cart} />
    </Elements>
  );
}
