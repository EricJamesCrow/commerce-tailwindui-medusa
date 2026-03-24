type InvoiceEligibleOrder = {
  status?: string | null;
  fulfillment_status?: string | null;
};

const ELIGIBLE_FULFILLMENT_STATUSES = new Set([
  "fulfilled",
  "shipped",
  "partially_shipped",
  "delivered",
  "partially_delivered",
]);

export function isInvoiceEligible(order: InvoiceEligibleOrder): boolean {
  if (order.status === "canceled") return false;
  if (order.status === "completed") return true;

  return (
    !!order.fulfillment_status &&
    ELIGIBLE_FULFILLMENT_STATUSES.has(order.fulfillment_status)
  );
}
