import type { HttpTypes } from "@medusajs/types";
import { sdk } from "lib/medusa";
import { getAuthHeaders } from "lib/medusa/cookies";
import { retrieveCustomer } from "lib/medusa/customer";
import { medusaError } from "lib/medusa/error";
import { formatMoney } from "lib/medusa/format";
import { redirect } from "next/navigation";
import Link from "next/link";

type StoreOrder = HttpTypes.StoreOrder & {
  payment_collections?: Array<{
    payments?: Array<{
      provider_id?: string;
      data?: {
        payment_method?: { card?: { brand?: string; last4?: string } };
        card?: { brand?: string; last4?: string };
      };
    }>;
    payment_sessions?: Array<{ provider_id?: string }>;
  }>;
  promotions?: Array<{ code?: string }>;
};

export const metadata = {
  title: "Order Confirmed",
};

async function getOrder(orderId: string) {
  const headers = await getAuthHeaders();
  try {
    const { order } = await sdk.client
      .fetch<{ order: StoreOrder }>(`/store/orders/${orderId}`, {
        method: "GET",
        headers,
        query: {
          fields:
            "*items,*items.variant,*items.product,*shipping_address,*billing_address,*shipping_methods,*payment_collections,*payment_collections.payments,*payment_collections.payment_sessions,+promotions",
        },
      })
      .catch(medusaError);
    return order;
  } catch (err) {
    console.error("[Order] Failed to retrieve order:", err);
    return null;
  }
}

function getPaymentMethodLabel(order: StoreOrder): string {
  const payment =
    order.payment_collections?.[0]?.payments?.[0] ||
    order.payment_collections?.[0]?.payment_sessions?.[0];
  if (!payment) return "Card";
  const providerId = payment.provider_id || "";
  if (providerId.includes("stripe")) return "Card (Stripe)";
  if (providerId.includes("paypal")) return "PayPal";
  return "Card";
}

function capitalizeBrand(brand: string | undefined): string {
  const b = brand || "card";
  return b.charAt(0).toUpperCase() + b.slice(1);
}

function getPaymentCardSummary(order: StoreOrder): string | null {
  const payment = order.payment_collections?.[0]?.payments?.[0];
  const data = payment?.data;
  if (data?.payment_method?.card) {
    const card = data.payment_method.card;
    return `${capitalizeBrand(card.brand)} ending in ${card.last4}`;
  }
  if (data?.card?.last4) {
    return `${capitalizeBrand(data.card.brand)} ending in ${data.card.last4}`;
  }
  return null;
}

export default async function OrderConfirmedPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const [order, customer] = await Promise.all([
    getOrder(orderId),
    retrieveCustomer(),
  ]);

  if (!order) {
    redirect("/");
  }

  // If the viewer is authenticated, verify they own this order.
  // Guest orders (no customer_id) are accessible by order ID (UUID acts as token).
  if (customer && order.customer_id && order.customer_id !== customer.id) {
    redirect("/");
  }

  const currencyCode = order.currency_code || "USD";

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-xl">
          <h1 className="text-primary-600 text-base font-medium">Thank you!</h1>
          <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Your order is confirmed
          </p>
          <p className="mt-2 text-base text-gray-500">
            Order #{order.display_id || order.id}
          </p>
        </div>

        <div className="mt-10 border-t border-gray-200">
          <h2 className="sr-only">Your order</h2>

          {/* Items */}
          <h3 className="sr-only">Items</h3>
          {(order.items || []).map(
            (item: NonNullable<StoreOrder["items"]>[number]) => (
              <div
                key={item.id}
                className="flex space-x-6 border-b border-gray-200 py-10"
              >
                {item.thumbnail || item.product?.thumbnail ? (
                  <img
                    alt={item.product?.title || item.title || ""}
                    src={item.thumbnail || item.product?.thumbnail || ""}
                    className="size-20 flex-none rounded-lg bg-gray-100 object-cover sm:size-40"
                  />
                ) : (
                  <div className="flex size-20 flex-none items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400 sm:size-40">
                    No image
                  </div>
                )}
                <div className="flex flex-auto flex-col">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {item.product?.title || item.title}
                    </h4>
                    {item.variant?.title &&
                      item.variant.title !== "Default" && (
                        <p className="mt-2 text-sm text-gray-600">
                          {item.variant.title}
                        </p>
                      )}
                  </div>
                  <div className="mt-6 flex flex-1 items-end">
                    <dl className="flex divide-x divide-gray-200 text-sm">
                      <div className="flex pr-4 sm:pr-6">
                        <dt className="font-medium text-gray-900">Quantity</dt>
                        <dd className="ml-2 text-gray-700">{item.quantity}</dd>
                      </div>
                      <div className="flex pl-4 sm:pl-6">
                        <dt className="font-medium text-gray-900">Price</dt>
                        <dd className="ml-2 text-gray-700">
                          {formatMoney(item.total, currencyCode)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            ),
          )}

          <div className="sm:ml-40 sm:pl-6">
            {/* Addresses */}
            <h3 className="sr-only">Your information</h3>
            <dl className="grid grid-cols-2 gap-x-6 py-10 text-sm">
              <div>
                <dt className="font-medium text-gray-900">Shipping address</dt>
                <dd className="mt-2 text-gray-700">
                  <address className="not-italic">
                    <span className="block">
                      {order.shipping_address?.first_name}{" "}
                      {order.shipping_address?.last_name}
                    </span>
                    <span className="block">
                      {order.shipping_address?.address_1}
                    </span>
                    <span className="block">
                      {order.shipping_address?.city},{" "}
                      {order.shipping_address?.province}{" "}
                      {order.shipping_address?.postal_code}
                    </span>
                  </address>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-900">Billing address</dt>
                <dd className="mt-2 text-gray-700">
                  <address className="not-italic">
                    <span className="block">
                      {order.billing_address?.first_name}{" "}
                      {order.billing_address?.last_name}
                    </span>
                    <span className="block">
                      {order.billing_address?.address_1}
                    </span>
                    <span className="block">
                      {order.billing_address?.city},{" "}
                      {order.billing_address?.province}{" "}
                      {order.billing_address?.postal_code}
                    </span>
                  </address>
                </dd>
              </div>
            </dl>

            {/* Payment & Shipping method */}
            <dl className="grid grid-cols-2 gap-x-6 border-t border-gray-200 py-10 text-sm">
              <div>
                <dt className="font-medium text-gray-900">Payment method</dt>
                <dd className="mt-2 text-gray-700">
                  <p>{getPaymentMethodLabel(order)}</p>
                  <p>{getPaymentCardSummary(order)}</p>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-900">Shipping method</dt>
                <dd className="mt-2 text-gray-700">
                  <p>
                    {order.shipping_methods?.[0]?.name || "Standard Shipping"}
                  </p>
                </dd>
              </div>
            </dl>

            {/* Summary */}
            <h3 className="sr-only">Summary</h3>
            <dl className="space-y-6 border-t border-gray-200 pt-10 text-sm">
              <div className="flex justify-between">
                <dt className="font-medium text-gray-900">Subtotal</dt>
                <dd className="text-gray-700">
                  {formatMoney(order.item_subtotal, currencyCode)}
                </dd>
              </div>
              {(order.discount_total ?? 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="flex font-medium text-gray-900">
                    Discount
                    {order.promotions?.[0]?.code && (
                      <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                        {order.promotions[0].code}
                      </span>
                    )}
                  </dt>
                  <dd className="text-gray-700">
                    -{formatMoney(order.discount_total, currencyCode)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="font-medium text-gray-900">Shipping</dt>
                <dd className="text-gray-700">
                  {formatMoney(order.shipping_total, currencyCode)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium text-gray-900">Tax</dt>
                <dd className="text-gray-700">
                  {formatMoney(order.tax_total, currencyCode)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-6">
                <dt className="text-base font-medium text-gray-900">Total</dt>
                <dd className="text-base text-gray-900">
                  {formatMoney(order.total, currencyCode)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Continue shopping link */}
        <div className="mt-16 border-t border-gray-200 py-6 text-right">
          <Link
            href="/"
            className="text-primary-600 hover:text-primary-500 text-sm font-medium"
          >
            Continue Shopping
            <span aria-hidden="true"> &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
