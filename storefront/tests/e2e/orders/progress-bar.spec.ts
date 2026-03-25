import { test, expect } from "../fixtures/auth.fixture";

/**
 * Progress Bar Rendering Tests
 *
 * These tests verify that the progress bar component renders correctly
 * for each fulfillment stage by rendering the account order pages with
 * authenticated customer state and mocked order data from a test cookie.
 *
 * Stages:
 *  step 0 — Order placed (not_fulfilled / null)
 *  step 1 — Processing (captured / fulfilled / partially_fulfilled)
 *  step 2 — Shipped (partially_shipped / shipped / partially_delivered)
 *  step 3 — Delivered (delivered)
 *
 * Progress bar width formula for in-flight states: calc((step * 2 + 1) / 8 * 100%)
 *  step 0 → 12.5%
 *  step 1 → 37.5%
 *  step 2 → 62.5%
 *  step 3 → 100%
 */

test.setTimeout(120_000);

const MOCK_ORDER_ID = "order_e2e_progress";

function buildMockOrder(
  fulfillmentStatus: string | null,
  paymentStatus = "not_paid",
  orderStatus = "pending",
) {
  const createdAt = "2026-03-24T12:00:00.000Z";

  return {
    id: MOCK_ORDER_ID,
    display_id: 1001,
    created_at: createdAt,
    currency_code: "usd",
    status: orderStatus,
    payment_status: paymentStatus,
    fulfillment_status: fulfillmentStatus,
    item_subtotal: 36,
    discount_total: 0,
    shipping_total: 5,
    tax_total: 3,
    total: 44,
    shipping_address: {
      first_name: "E2E",
      last_name: "Tester",
      address_1: "123 Test Street",
      city: "New York",
      province: "NY",
      postal_code: "10001",
    },
    billing_address: {
      first_name: "E2E",
      last_name: "Tester",
      address_1: "123 Test Street",
      city: "New York",
      province: "NY",
      postal_code: "10001",
    },
    shipping_methods: [{ name: "Standard Shipping" }],
    payment_collections: [
      {
        payments: [
          {
            created_at: "2026-03-24T12:05:00.000Z",
            data: {
              payment_method: {
                card: {
                  brand: "visa",
                  last4: "4242",
                  exp_month: 12,
                  exp_year: 2030,
                },
              },
            },
          },
        ],
      },
    ],
    items: [
      {
        id: "item_e2e_progress",
        title: "Basic Tee",
        product_handle: "basic-tee",
        quantity: 1,
        unit_price: 36,
        thumbnail:
          "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
        variant: { title: "S" },
        product: { title: "Basic Tee" },
      },
    ],
    fulfillments: fulfillmentStatus
      ? [
          {
            created_at: "2026-03-24T12:10:00.000Z",
            shipped_at:
              fulfillmentStatus === "partially_shipped" ||
              fulfillmentStatus === "shipped" ||
              fulfillmentStatus === "partially_delivered"
                ? "2026-03-24T12:15:00.000Z"
                : null,
            delivered_at:
              fulfillmentStatus === "delivered"
                ? "2026-03-24T12:20:00.000Z"
                : null,
          },
        ]
      : [],
  };
}

async function installMockOrders(
  page: import("@playwright/test").Page,
  fulfillmentStatus: string | null,
  paymentStatus = "not_paid",
  orderStatus = "pending",
) {
  const fixture = {
    orders: [buildMockOrder(fulfillmentStatus, paymentStatus, orderStatus)],
  };

  await page.context().addCookies([
    {
      name: "__e2e_orders_enabled",
      value: "1",
      url: "http://localhost:3000",
    },
    {
      name: "__e2e_orders",
      value: encodeURIComponent(JSON.stringify(fixture)),
      url: "http://localhost:3000",
    },
  ]);
}

/** Navigate to the mocked order list as an authenticated customer */
async function loginAndGoToOrders(
  page: import("@playwright/test").Page,
  fulfillmentStatus: string | null,
  paymentStatus = "not_paid",
  orderStatus = "pending",
) {
  await installMockOrders(page, fulfillmentStatus, paymentStatus, orderStatus);
  await page.goto(`/account/orders?fixture=${Date.now()}`);
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: "Order History" }),
  ).toBeVisible({ timeout: 15_000 });
}

/** Navigate to the first order's detail page */
async function goToFirstOrderDetail(page: import("@playwright/test").Page) {
  const viewOrderLink = page.locator('a:has-text("View Order")').first();
  await expect(viewOrderLink).toBeVisible({ timeout: 10_000 });
  await viewOrderLink.click();
  await page.waitForURL("**/account/orders/**", { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: "Order Details" }),
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Mock the Medusa order API to return a specific fulfillment_status.
 * Intercepts the /store/orders/:id request and patches the response.
 */
test.describe("Progress Bar — Fulfillment Stages", () => {
  test.describe.configure({ mode: "serial" });

  test("step 0 — Order placed (not_fulfilled)", async ({
    authedPage: page,
  }) => {
    await loginAndGoToOrders(page, "not_fulfilled");
    await goToFirstOrderDetail(page);

    // Progress bar should exist and NOT be canceled
    const progressBar = page.locator(
      ".overflow-hidden.rounded-full.bg-gray-200",
    );
    await expect(progressBar).toBeVisible();

    // Inner bar width: calc((0 * 2 + 1) / 8 * 100%) = 12.5%
    const innerBar = progressBar.locator(".bg-primary-600");
    await expect(innerBar).toBeVisible();
    const width = await innerBar.evaluate((el) => el.style.width);
    expect(width).toBe("calc(12.5%)");

    // "Order placed" label should be highlighted
    const labels = page.locator(".hidden.grid-cols-4 div");
    await expect(labels.nth(0)).toHaveClass(/text-primary-600/);

    // "Processing", "Shipped", "Delivered" should NOT be highlighted
    await expect(labels.nth(1)).not.toHaveClass(/text-primary-600/);
    await expect(labels.nth(2)).not.toHaveClass(/text-primary-600/);
    await expect(labels.nth(3)).not.toHaveClass(/text-primary-600/);

    // Status text
    await expect(page.locator('p:has-text("Order placed")')).toBeVisible();
  });

  test("step 1 — Processing (fulfilled)", async ({ authedPage: page }) => {
    await loginAndGoToOrders(page, "fulfilled", "captured");
    await goToFirstOrderDetail(page);

    const progressBar = page.locator(
      ".overflow-hidden.rounded-full.bg-gray-200",
    );
    await expect(progressBar).toBeVisible();

    // Inner bar width: calc((1 * 2 + 1) / 8 * 100%) = 37.5%
    const innerBar = progressBar.locator(".bg-primary-600");
    const width = await innerBar.evaluate((el) => el.style.width);
    expect(width).toBe("calc(37.5%)");

    // "Order placed" and "Processing" should be highlighted
    const labels = page.locator(".hidden.grid-cols-4 div");
    await expect(labels.nth(0)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(1)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(2)).not.toHaveClass(/text-primary-600/);
    await expect(labels.nth(3)).not.toHaveClass(/text-primary-600/);

    // Status text
    await expect(page.locator('p:has-text("Processing")')).toBeVisible();
  });

  test("step 1 — Processing (captured before shipment)", async ({
    authedPage: page,
  }) => {
    await loginAndGoToOrders(page, "not_fulfilled", "captured");
    await goToFirstOrderDetail(page);

    const labels = page.locator(".hidden.grid-cols-4 div");
    await expect(labels.nth(0)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(1)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(2)).not.toHaveClass(/text-primary-600/);
    await expect(labels.nth(3)).not.toHaveClass(/text-primary-600/);

    await expect(page.locator('p:has-text("Processing")')).toBeVisible();
  });

  test("step 2 — Shipped", async ({ authedPage: page }) => {
    await loginAndGoToOrders(page, "shipped", "captured");
    await goToFirstOrderDetail(page);

    const progressBar = page.locator(
      ".overflow-hidden.rounded-full.bg-gray-200",
    );
    await expect(progressBar).toBeVisible();

    // Inner bar width: calc((2 * 2 + 1) / 8 * 100%) = 62.5%
    const innerBar = progressBar.locator(".bg-primary-600");
    const width = await innerBar.evaluate((el) => el.style.width);
    expect(width).toBe("calc(62.5%)");

    // First 3 labels should be highlighted
    const labels = page.locator(".hidden.grid-cols-4 div");
    await expect(labels.nth(0)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(1)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(2)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(3)).not.toHaveClass(/text-primary-600/);

    // Status text
    await expect(page.locator('p:has-text("Shipped")')).toBeVisible();
  });

  test("step 2 — partially_shipped maps to Shipped", async ({
    authedPage: page,
  }) => {
    await loginAndGoToOrders(page, "partially_shipped", "captured");
    await goToFirstOrderDetail(page);

    const labels = page.locator(".hidden.grid-cols-4 div");
    await expect(labels.nth(0)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(1)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(2)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(3)).not.toHaveClass(/text-primary-600/);

    await expect(page.locator('p:has-text("Shipped")')).toBeVisible();
  });

  test("step 2 — partially_delivered maps to Shipped", async ({
    authedPage: page,
  }) => {
    await loginAndGoToOrders(page, "partially_delivered", "captured");
    await goToFirstOrderDetail(page);

    const labels = page.locator(".hidden.grid-cols-4 div");
    await expect(labels.nth(0)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(1)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(2)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(3)).not.toHaveClass(/text-primary-600/);

    await expect(page.locator('p:has-text("Shipped")')).toBeVisible();
  });

  test("step 3 — Delivered", async ({ authedPage: page }) => {
    await loginAndGoToOrders(page, "delivered", "captured");
    await goToFirstOrderDetail(page);

    const progressBar = page.locator(
      ".overflow-hidden.rounded-full.bg-gray-200",
    );
    await expect(progressBar).toBeVisible();

    // Delivered should render as fully complete.
    const innerBar = progressBar.locator(".bg-primary-600");
    const width = await innerBar.evaluate((el) => el.style.width);
    expect(width).toBe("100%");

    // All 4 labels should be highlighted
    const labels = page.locator(".hidden.grid-cols-4 div");
    await expect(labels.nth(0)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(1)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(2)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(3)).toHaveClass(/text-primary-600/);

    // Status text
    await expect(page.locator('p:has-text("Delivered")')).toBeVisible();
  });

  test("fulfilled no longer maps to Delivered", async ({
    authedPage: page,
  }) => {
    await loginAndGoToOrders(page, "fulfilled", "captured");
    await goToFirstOrderDetail(page);

    const labels = page.locator(".hidden.grid-cols-4 div");
    await expect(labels.nth(0)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(1)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(2)).not.toHaveClass(/text-primary-600/);
    await expect(labels.nth(3)).not.toHaveClass(/text-primary-600/);

    await expect(page.locator('p:has-text("Processing")')).toBeVisible();
  });
});

test.describe("Progress Bar — Edge Cases", () => {
  test("canceled order hides progress bar and shows banner", async ({
    authedPage: page,
  }) => {
    await loginAndGoToOrders(page, "not_fulfilled", "not_paid", "canceled");
    await goToFirstOrderDetail(page);

    // Progress bar should NOT be visible
    const progressBar = page.locator(
      ".overflow-hidden.rounded-full.bg-gray-200",
    );
    await expect(progressBar).not.toBeVisible();

    // Canceled banner should be visible
    await expect(
      page.locator('text="This order has been canceled."'),
    ).toBeVisible();
  });

  test("null fulfillment_status defaults to step 0", async ({
    authedPage: page,
  }) => {
    await loginAndGoToOrders(page, null);
    await goToFirstOrderDetail(page);

    const labels = page.locator(".hidden.grid-cols-4 div");
    await expect(labels.nth(0)).toHaveClass(/text-primary-600/);
    await expect(labels.nth(1)).not.toHaveClass(/text-primary-600/);

    await expect(page.locator('p:has-text("Order placed")')).toBeVisible();
  });

  test("invoice button shows for shipped orders", async ({
    authedPage: page,
  }) => {
    await loginAndGoToOrders(page, "shipped", "captured");
    await goToFirstOrderDetail(page);

    // Invoice download button should be visible
    await expect(
      page.getByRole("button", { name: "Download Invoice" }).first(),
    ).toBeVisible();
  });

  test("invoice button hidden for new orders (not_fulfilled)", async ({
    authedPage: page,
  }) => {
    await loginAndGoToOrders(page, "not_fulfilled");
    await goToFirstOrderDetail(page);

    // Invoice button should NOT be present
    await expect(
      page.locator('button:has-text("Download Invoice")'),
    ).not.toBeVisible();
  });
});
