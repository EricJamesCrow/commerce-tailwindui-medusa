import type { StoreOrderDetail } from "lib/medusa";
import { DEFAULT_LOCALE } from "lib/constants";
import { formatMoney } from "lib/medusa/format";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import {
  CUSTOMER_ORDER_PROGRESS_STEPS,
  deriveCustomerOrderProgress,
} from "./order-status";
import { DownloadInvoiceButton } from "./download-invoice-button";
import { isInvoiceEligible } from "./order-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(DEFAULT_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function capitalizeBrand(brand: string | undefined): string {
  const b = brand || "card";
  return b.charAt(0).toUpperCase() + b.slice(1);
}

function getPaymentCard(order: StoreOrderDetail) {
  const payment = order.payment_collections?.[0]?.payments?.[0];
  const data = payment?.data;
  const card = data?.payment_method?.card || data?.card;
  if (!card?.last4) return null;
  return {
    brand: capitalizeBrand(card.brand),
    last4: card.last4,
    expMonth: card.exp_month,
    expYear: card.exp_year,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const LAST_PROGRESS_STEP_INDEX = CUSTOMER_ORDER_PROGRESS_STEPS.length - 1;

function getProgressLabelAlignment(stepIndex: number): string {
  if (stepIndex === 0) return "text-left";
  if (stepIndex === LAST_PROGRESS_STEP_INDEX) return "text-right";
  return "text-center";
}

function getProgressWidth(step: number): string {
  const clampedStep = Math.max(0, Math.min(step, LAST_PROGRESS_STEP_INDEX));

  // Preserve the staggered fill behavior for in-flight stages, but let the
  // terminal state render as fully complete.
  if (clampedStep === LAST_PROGRESS_STEP_INDEX) {
    return "100%";
  }

  return `calc((${clampedStep} * 2 + 1) / ${CUSTOMER_ORDER_PROGRESS_STEPS.length * 2} * 100%)`;
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mt-6">
      <div className="overflow-hidden rounded-full bg-gray-200">
        <div
          style={{ width: getProgressWidth(step) }}
          className="bg-primary-600 h-2 rounded-full"
        />
      </div>
      <div className="mt-6 hidden grid-cols-4 text-sm font-medium text-gray-600 sm:grid">
        {CUSTOMER_ORDER_PROGRESS_STEPS.map((label, i) => (
          <div
            key={label}
            className={clsx(
              step >= i ? "text-primary-600" : "",
              getProgressLabelAlignment(i),
            )}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddressBlock({
  label,
  address,
}: {
  label: string;
  address: StoreOrderDetail["shipping_address"];
}) {
  if (!address) return null;
  return (
    <div>
      <dt className="font-medium text-gray-900">{label}</dt>
      <dd className="mt-3 text-gray-500">
        <span className="block">
          {address.first_name} {address.last_name}
        </span>
        {address.company && <span className="block">{address.company}</span>}
        <span className="block">{address.address_1}</span>
        {address.address_2 && (
          <span className="block">{address.address_2}</span>
        )}
        <span className="block">
          {address.city}, {address.province} {address.postal_code}
        </span>
        {address.phone && <span className="mt-1 block">{address.phone}</span>}
      </dd>
    </div>
  );
}

/** Visa SVG card icon */
function VisaSvg() {
  return (
    <svg
      width={36}
      height={24}
      viewBox="0 0 36 24"
      aria-hidden="true"
      className="h-6 w-auto"
    >
      <rect rx={4} fill="#224DBA" width={36} height={24} />
      <path
        d="M10.925 15.673H8.874l-1.538-6c-.073-.276-.228-.52-.456-.635A6.575 6.575 0 005 8.403v-.231h3.304c.456 0 .798.347.855.75l.798 4.328 2.05-5.078h1.994l-3.076 7.5zm4.216 0h-1.937L14.8 8.172h1.937l-1.595 7.5zm4.101-5.422c.057-.404.399-.635.798-.635a3.54 3.54 0 011.88.346l.342-1.615A4.808 4.808 0 0020.496 8c-1.88 0-3.248 1.039-3.248 2.481 0 1.097.969 1.673 1.653 2.02.74.346 1.025.577.968.923 0 .519-.57.75-1.139.75a4.795 4.795 0 01-1.994-.462l-.342 1.616a5.48 5.48 0 002.108.404c2.108.057 3.418-.981 3.418-2.539 0-1.962-2.678-2.077-2.678-2.942zm9.457 5.422L27.16 8.172h-1.652a.858.858 0 00-.798.577l-2.848 6.924h1.994l.398-1.096h2.45l.228 1.096h1.766zm-2.905-5.482l.57 2.827h-1.596l1.026-2.827z"
        fill="#fff"
      />
    </svg>
  );
}

/** Generic card SVG icon for non-Visa brands */
function CardSvg() {
  return (
    <svg
      className="h-6 w-auto text-gray-400"
      width={36}
      height={24}
      viewBox="0 0 36 24"
      fill="none"
      aria-hidden="true"
    >
      <rect rx={4} fill="currentColor" width={36} height={24} opacity={0.2} />
      <rect
        x={2}
        y={6}
        width={32}
        height={4}
        rx={1}
        fill="currentColor"
        opacity={0.4}
      />
      <rect
        x={4}
        y={14}
        width={8}
        height={2}
        rx={1}
        fill="currentColor"
        opacity={0.3}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function OrderDetail({ order }: { order: StoreOrderDetail }) {
  const currencyCode = order.currency_code || "usd";
  const progress = deriveCustomerOrderProgress(order);
  const step = progress.step ?? 0;
  const canceled = progress.canceled;
  const showInvoice = isInvoiceEligible(order);
  const card = getPaymentCard(order);
  const statusTimestamp = progress.timestamp;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        Order Details
      </h1>

      {/* Order header: number, date, invoice link */}
      <div className="mt-2 border-b border-gray-200 pb-5 text-sm sm:flex sm:justify-between">
        <dl className="flex">
          <dt className="text-gray-500">Order number&nbsp;</dt>
          <dd className="font-medium text-gray-900">#{order.display_id}</dd>
          <dt>
            <span className="sr-only">Date</span>
            <span aria-hidden="true" className="mx-2 text-gray-400">
              &middot;
            </span>
          </dt>
          <dd className="font-medium text-gray-900">
            <time dateTime={order.created_at as string}>
              {formatDate(order.created_at as string)}
            </time>
          </dd>
        </dl>
        <div className="mt-4 flex items-center gap-x-4 sm:mt-0">
          {showInvoice && <DownloadInvoiceButton orderId={order.id} />}
        </div>
      </div>

      {/* Canceled banner */}
      {canceled && (
        <div className="mt-6 rounded-md bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            This order has been canceled.
          </p>
        </div>
      )}

      {/* Product items with large images and progress bars */}
      <section aria-labelledby="products-heading" className="mt-8">
        <h2 id="products-heading" className="sr-only">
          Products purchased
        </h2>

        <div className="space-y-24">
          {order.items?.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 text-sm sm:grid-cols-12 sm:grid-rows-1 sm:gap-x-6 md:gap-x-8 lg:gap-x-8"
            >
              {/* Large product image */}
              <div className="sm:col-span-4 md:col-span-5 md:row-span-2 md:row-end-2">
                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-50">
                  {item.thumbnail ? (
                    <Image
                      src={item.thumbnail}
                      alt={item.product?.title || item.title}
                      fill
                      sizes="(min-width: 768px) 40vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-gray-400">
                      No image
                    </div>
                  )}
                </div>
              </div>

              {/* Product info */}
              <div className="mt-6 sm:col-span-7 sm:mt-0 md:row-end-1">
                <h3 className="text-lg font-medium text-gray-900">
                  {item.product_handle ? (
                    <Link href={`/product/${item.product_handle}`}>
                      {item.product?.title || item.title}
                    </Link>
                  ) : (
                    item.product?.title || item.title
                  )}
                </h3>
                <p className="mt-1 font-medium text-gray-900">
                  {formatMoney(item.unit_price as number, currencyCode)}
                </p>
                {item.variant?.title && item.variant.title !== "Default" && (
                  <p className="mt-1 text-gray-500">{item.variant.title}</p>
                )}
                <p className="mt-1 text-gray-500">Qty: {item.quantity}</p>
              </div>

              {/* Delivery info + progress bar */}
              <div className="sm:col-span-12 md:col-span-7">
                <dl className="grid grid-cols-1 gap-y-8 border-b border-gray-200 py-8 sm:grid-cols-2 sm:gap-x-6 sm:py-6 md:py-10">
                  <AddressBlock
                    label="Delivery address"
                    address={order.shipping_address}
                  />
                  <div>
                    <dt className="font-medium text-gray-900">
                      Shipping method
                    </dt>
                    <dd className="mt-3 text-gray-500">
                      <p>
                        {order.shipping_methods?.[0]?.name ||
                          "Standard Shipping"}
                      </p>
                    </dd>
                  </div>
                </dl>

                {/* Progress bar (hidden when canceled) */}
                {!canceled && (
                  <>
                    <p className="mt-6 font-medium text-gray-900 md:mt-10">
                      {progress.label}{" "}
                      {statusTimestamp && (
                        <span className="font-normal text-gray-500">
                          on{" "}
                          <time dateTime={statusTimestamp}>
                            {formatDate(statusTimestamp)}
                          </time>
                        </span>
                      )}
                    </p>
                    <ProgressBar step={step} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Billing summary */}
      <section aria-labelledby="summary-heading" className="mt-24">
        <h2 id="summary-heading" className="sr-only">
          Billing Summary
        </h2>

        <div className="rounded-lg bg-gray-50 px-6 py-6 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:px-0 lg:py-8">
          <dl className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-2 md:gap-x-8 lg:col-span-5 lg:pl-8">
            <AddressBlock
              label="Billing address"
              address={order.billing_address}
            />
            <div>
              <dt className="font-medium text-gray-900">Payment information</dt>
              <dd className="mt-3 flex">
                <div>
                  {card?.brand?.toLowerCase() === "visa" ? (
                    <VisaSvg />
                  ) : (
                    <CardSvg />
                  )}
                  <p className="sr-only">{card?.brand || "Card"}</p>
                </div>
                <div className="ml-4">
                  {card ? (
                    <>
                      <p className="text-gray-900">Ending with {card.last4}</p>
                      {card.expMonth && card.expYear && (
                        <p className="text-gray-600">
                          Expires {String(card.expMonth).padStart(2, "0")} /{" "}
                          {String(card.expYear).slice(-2)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500">Card on file</p>
                  )}
                </div>
              </dd>
            </div>
          </dl>

          <dl className="mt-8 divide-y divide-gray-200 text-sm lg:col-span-7 lg:mt-0 lg:pr-8">
            <div className="flex items-center justify-between pb-4">
              <dt className="text-gray-600">Subtotal</dt>
              <dd className="font-medium text-gray-900">
                {formatMoney(order.item_subtotal, currencyCode)}
              </dd>
            </div>
            {(order.discount_total ?? 0) > 0 && (
              <div className="flex items-center justify-between py-4">
                <dt className="flex text-gray-600">
                  Discount
                  {order.promotions?.[0]?.code && (
                    <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                      {order.promotions[0].code}
                    </span>
                  )}
                </dt>
                <dd className="font-medium text-gray-900">
                  -{formatMoney(order.discount_total, currencyCode)}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between py-4">
              <dt className="text-gray-600">Shipping</dt>
              <dd className="font-medium text-gray-900">
                {formatMoney(order.shipping_total, currencyCode)}
              </dd>
            </div>
            <div className="flex items-center justify-between py-4">
              <dt className="text-gray-600">Tax</dt>
              <dd className="font-medium text-gray-900">
                {formatMoney(order.tax_total, currencyCode)}
              </dd>
            </div>
            <div className="flex items-center justify-between pt-4">
              <dt className="font-medium text-gray-900">Order total</dt>
              <dd className="text-primary-600 font-medium">
                {formatMoney(order.total, currencyCode)}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
