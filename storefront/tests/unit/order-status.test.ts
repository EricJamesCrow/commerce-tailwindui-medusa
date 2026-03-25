import { describe, expect, test } from "vitest";
import { deriveCustomerOrderProgress } from "components/account/order-status";

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    status: "pending",
    payment_status: "not_paid",
    fulfillment_status: "not_fulfilled",
    created_at: "2026-03-24T12:00:00.000Z",
    fulfillments: [],
    payment_collections: [],
    ...overrides,
  };
}

describe("deriveCustomerOrderProgress", () => {
  test("maps not_fulfilled + not_paid to placed", () => {
    expect(deriveCustomerOrderProgress(buildOrder())).toMatchObject({
      state: "placed",
      label: "Order placed",
      step: 0,
      canceled: false,
    });
  });

  test("maps captured payment without shipment to processing", () => {
    expect(
      deriveCustomerOrderProgress(
        buildOrder({
          payment_status: "captured",
          payment_collections: [
            {
              payments: [{ created_at: "2026-03-24T12:05:00.000Z" }],
            },
          ],
        }),
      ),
    ).toMatchObject({
      state: "processing",
      label: "Processing",
      step: 1,
      timestamp: "2026-03-24T12:05:00.000Z",
    });
  });

  test("maps fulfilled + captured to processing", () => {
    expect(
      deriveCustomerOrderProgress(
        buildOrder({
          payment_status: "captured",
          fulfillment_status: "fulfilled",
          fulfillments: [{ created_at: "2026-03-24T12:10:00.000Z" }],
        }),
      ),
    ).toMatchObject({
      state: "processing",
      label: "Processing",
      step: 1,
      timestamp: "2026-03-24T12:10:00.000Z",
    });
  });

  test("maps partially_fulfilled to processing", () => {
    expect(
      deriveCustomerOrderProgress(
        buildOrder({
          fulfillment_status: "partially_fulfilled",
        }),
      ),
    ).toMatchObject({
      state: "processing",
      step: 1,
    });
  });

  test("maps partially_shipped to shipped", () => {
    expect(
      deriveCustomerOrderProgress(
        buildOrder({
          fulfillment_status: "partially_shipped",
          fulfillments: [{ shipped_at: "2026-03-24T12:15:00.000Z" }],
        }),
      ),
    ).toMatchObject({
      state: "shipped",
      label: "Shipped",
      step: 2,
      timestamp: "2026-03-24T12:15:00.000Z",
    });
  });

  test("maps shipped to shipped", () => {
    expect(
      deriveCustomerOrderProgress(
        buildOrder({
          fulfillment_status: "shipped",
        }),
      ),
    ).toMatchObject({
      state: "shipped",
      step: 2,
    });
  });

  test("maps partially_delivered to shipped", () => {
    expect(
      deriveCustomerOrderProgress(
        buildOrder({
          fulfillment_status: "partially_delivered",
        }),
      ),
    ).toMatchObject({
      state: "shipped",
      step: 2,
    });
  });

  test("does not promote partially_delivered orders to delivered from timestamps", () => {
    expect(
      deriveCustomerOrderProgress(
        buildOrder({
          fulfillment_status: "partially_delivered",
          fulfillments: [
            {
              shipped_at: "2026-03-24T12:15:00.000Z",
              delivered_at: "2026-03-24T12:20:00.000Z",
            },
          ],
        }),
      ),
    ).toMatchObject({
      state: "shipped",
      label: "Shipped",
      step: 2,
      timestamp: "2026-03-24T12:15:00.000Z",
    });
  });

  test("maps delivered to delivered", () => {
    expect(
      deriveCustomerOrderProgress(
        buildOrder({
          fulfillment_status: "delivered",
          fulfillments: [{ delivered_at: "2026-03-24T12:20:00.000Z" }],
        }),
      ),
    ).toMatchObject({
      state: "delivered",
      label: "Delivered",
      step: 3,
      timestamp: "2026-03-24T12:20:00.000Z",
    });
  });

  test("uses canceled override", () => {
    expect(
      deriveCustomerOrderProgress(
        buildOrder({
          status: "canceled",
          payment_status: "captured",
          fulfillment_status: "delivered",
        }),
      ),
    ).toMatchObject({
      state: "canceled",
      label: null,
      step: null,
      canceled: true,
    });
  });

  test("falls back safely when statuses are missing", () => {
    expect(
      deriveCustomerOrderProgress(
        buildOrder({
          status: null,
          payment_status: null,
          fulfillment_status: null,
        }),
      ),
    ).toMatchObject({
      state: "placed",
      label: "Order placed",
      step: 0,
    });
  });
});
