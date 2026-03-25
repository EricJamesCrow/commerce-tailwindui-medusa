export type CustomerOrderProgress =
  | "placed"
  | "processing"
  | "shipped"
  | "delivered"
  | "canceled";

export const CUSTOMER_ORDER_PROGRESS_LABELS: Record<
  Exclude<CustomerOrderProgress, "canceled">,
  string
> = {
  placed: "Order placed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
};

export const CUSTOMER_ORDER_PROGRESS_STEPS = [
  CUSTOMER_ORDER_PROGRESS_LABELS.placed,
  CUSTOMER_ORDER_PROGRESS_LABELS.processing,
  CUSTOMER_ORDER_PROGRESS_LABELS.shipped,
  CUSTOMER_ORDER_PROGRESS_LABELS.delivered,
] as const;

const SHIPPED_FULFILLMENT_STATUSES = new Set([
  "partially_shipped",
  "shipped",
  "partially_delivered",
]);

const PROCESSING_FULFILLMENT_STATUSES = new Set([
  "partially_fulfilled",
  "fulfilled",
]);

const PROCESSING_PAYMENT_STATUSES = new Set([
  "awaiting",
  "authorized",
  "partially_authorized",
  "captured",
  "partially_captured",
  "partially_refunded",
]);

type FulfillmentLike = {
  created_at?: string | Date | null;
  shipped_at?: string | Date | null;
  delivered_at?: string | Date | null;
} | null;

type PaymentLike = {
  created_at?: string | Date | null;
} | null;

type PaymentCollectionLike = {
  payments?: PaymentLike[] | null;
} | null;

export type CustomerOrderStatusSource = {
  status?: string | null;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  created_at?: string | Date | null;
  fulfillments?: FulfillmentLike[] | null;
  payment_collections?: PaymentCollectionLike[] | null;
};

export type CustomerOrderProgressSummary = {
  state: CustomerOrderProgress;
  label: string | null;
  step: number | null;
  timestamp: string | null;
  canceled: boolean;
};

function toTimestamp(value: string | Date | null | undefined): number | null {
  if (!value) return null;

  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getLatestDate(
  values: Array<string | Date | null | undefined>,
): string | null {
  const datedValues = values
    .map((value) => ({
      value,
      timestamp: toTimestamp(value),
    }))
    .filter(
      (
        entry,
      ): entry is {
        value: string | Date;
        timestamp: number;
      } => entry.timestamp !== null && !!entry.value,
    )
    .sort((a, b) => b.timestamp - a.timestamp);

  return datedValues[0] ? String(datedValues[0].value) : null;
}

function getLatestFulfillmentDate(
  fulfillments: FulfillmentLike[] | null | undefined,
  field: "created_at" | "shipped_at" | "delivered_at",
): string | null {
  return getLatestDate(
    (fulfillments || []).map((fulfillment) => fulfillment?.[field]),
  );
}

function getLatestPaymentDate(
  paymentCollections: PaymentCollectionLike[] | null | undefined,
): string | null {
  const paymentDates = (paymentCollections || []).flatMap(
    (collection) =>
      collection?.payments?.map((payment) => payment?.created_at) || [],
  );

  return getLatestDate(paymentDates);
}

export function deriveCustomerOrderProgress(
  order: CustomerOrderStatusSource,
): CustomerOrderProgressSummary {
  const createdAt = order.created_at ? String(order.created_at) : null;
  const fulfillmentStatus = order.fulfillment_status || "";

  if (order.status === "canceled") {
    return {
      state: "canceled",
      label: null,
      step: null,
      timestamp: createdAt,
      canceled: true,
    };
  }

  const deliveredAt = getLatestFulfillmentDate(
    order.fulfillments,
    "delivered_at",
  );

  if (fulfillmentStatus === "delivered") {
    return {
      state: "delivered",
      label: CUSTOMER_ORDER_PROGRESS_LABELS.delivered,
      step: 3,
      timestamp: deliveredAt || createdAt,
      canceled: false,
    };
  }

  const shippedAt = getLatestFulfillmentDate(order.fulfillments, "shipped_at");

  if (SHIPPED_FULFILLMENT_STATUSES.has(fulfillmentStatus)) {
    return {
      state: "shipped",
      label: CUSTOMER_ORDER_PROGRESS_LABELS.shipped,
      step: 2,
      timestamp: shippedAt || createdAt,
      canceled: false,
    };
  }

  const fulfilledAt = getLatestFulfillmentDate(
    order.fulfillments,
    "created_at",
  );

  if (PROCESSING_FULFILLMENT_STATUSES.has(fulfillmentStatus)) {
    return {
      state: "processing",
      label: CUSTOMER_ORDER_PROGRESS_LABELS.processing,
      step: 1,
      timestamp: fulfilledAt || createdAt,
      canceled: false,
    };
  }

  if (deliveredAt) {
    return {
      state: "delivered",
      label: CUSTOMER_ORDER_PROGRESS_LABELS.delivered,
      step: 3,
      timestamp: deliveredAt,
      canceled: false,
    };
  }

  if (shippedAt) {
    return {
      state: "shipped",
      label: CUSTOMER_ORDER_PROGRESS_LABELS.shipped,
      step: 2,
      timestamp: shippedAt,
      canceled: false,
    };
  }

  const paymentUpdatedAt = getLatestPaymentDate(order.payment_collections);

  if (PROCESSING_PAYMENT_STATUSES.has(order.payment_status || "")) {
    return {
      state: "processing",
      label: CUSTOMER_ORDER_PROGRESS_LABELS.processing,
      step: 1,
      timestamp: paymentUpdatedAt || createdAt,
      canceled: false,
    };
  }

  return {
    state: "placed",
    label: CUSTOMER_ORDER_PROGRESS_LABELS.placed,
    step: 0,
    timestamp: createdAt,
    canceled: false,
  };
}
