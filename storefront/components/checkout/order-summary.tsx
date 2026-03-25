import type { HttpTypes } from "@medusajs/types";
import { RemoveItemButton } from "components/checkout/checkout-item-actions";
import { formatMoney } from "lib/medusa/format";
import Link from "next/link";

export function OrderSummary({ cart }: { cart: HttpTypes.StoreCart }) {
  const currencyCode = cart.currency_code || "USD";

  return (
    <>
      <h2 className="sr-only">Order summary</h2>

      <div className="flow-root">
        <ul role="list" className="-my-6 divide-y divide-gray-200">
          {(cart.items || []).map((item) => {
            const handle = (item.product as { handle?: string } | undefined)
              ?.handle;
            const thumbnail = item.thumbnail || item.product?.thumbnail;

            return (
              <li key={item.id} className="flex space-x-6 py-6">
                {thumbnail ? (
                  <img
                    alt={item.product?.title || item.title || ""}
                    src={thumbnail}
                    className="size-24 flex-none rounded-md bg-gray-100 object-cover"
                  />
                ) : (
                  <div className="flex size-24 flex-none items-center justify-center rounded-md bg-gray-100 text-sm text-gray-400">
                    No image
                  </div>
                )}
                <div className="flex-auto">
                  <div className="space-y-1 sm:flex sm:items-start sm:justify-between sm:space-x-6">
                    <div className="flex-auto space-y-1 text-sm font-medium">
                      <h3 className="text-gray-900">
                        {item.product?.title || item.title}
                      </h3>
                      <p className="text-gray-900">
                        {formatMoney(item.total, currencyCode)}
                      </p>
                      {item.variant?.title &&
                        item.variant.title !== "Default" && (
                          <p className="hidden text-gray-500 sm:block">
                            {item.variant.title}
                          </p>
                        )}
                      {item.quantity > 1 && (
                        <p className="text-gray-500">Qty: {item.quantity}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex space-x-4 text-sm">
                    {handle && (
                      <Link
                        href={`/product/${handle}`}
                        className="text-primary-600 hover:text-primary-500 font-medium"
                      >
                        Edit
                      </Link>
                    )}
                    {item.id && <RemoveItemButton lineItemId={item.id} />}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <dl className="mt-10 space-y-6 text-sm font-medium text-gray-500">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd className="text-gray-900">
            {formatMoney(cart.item_subtotal, currencyCode)}
          </dd>
        </div>
        {(cart.shipping_total ?? 0) > 0 && (
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd className="text-gray-900">
              {formatMoney(cart.shipping_total, currencyCode)}
            </dd>
          </div>
        )}
        {(cart.tax_total ?? 0) > 0 && (
          <div className="flex justify-between">
            <dt>Taxes</dt>
            <dd className="text-gray-900">
              {formatMoney(cart.tax_total, currencyCode)}
            </dd>
          </div>
        )}
        {(cart.discount_total ?? 0) > 0 && (
          <div className="flex justify-between">
            <dt>Discount</dt>
            <dd className="text-gray-900">
              -{formatMoney(cart.discount_total, currencyCode)}
            </dd>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-200 pt-6 text-gray-900">
          <dt className="text-base">Total</dt>
          <dd className="text-base">{formatMoney(cart.total, currencyCode)}</dd>
        </div>
      </dl>
    </>
  );
}
