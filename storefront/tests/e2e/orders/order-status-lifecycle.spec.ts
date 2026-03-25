import { expect, test } from "@playwright/test";
import { loginThroughAccountPage } from "../helpers/account-login";
import {
  TEST_ADDRESS,
  addToCartAndCheckout,
  fillStripeCard,
  selectShippingOption,
} from "../fixtures/checkout.fixture";
import * as sel from "../helpers/selectors";
import { BACKEND_URL } from "../fixtures/api.fixture";
import { deriveCustomerOrderProgress } from "../../../components/account/order-status";

test.setTimeout(240_000);

const REAL_ACCOUNT_EMAIL = process.env.E2E_REAL_ACCOUNT_EMAIL;
const REAL_ACCOUNT_PASSWORD = process.env.E2E_REAL_ACCOUNT_PASSWORD;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

type AdminOrder = {
  id: string;
  display_id: number;
  status?: string | null;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  created_at?: string | null;
  items?: Array<{ id: string; quantity: number }>;
  fulfillments?: Array<{
    id: string;
    created_at?: string | null;
    shipped_at?: string | null;
    delivered_at?: string | null;
  }>;
  payment_collections?: Array<{
    payments?: Array<{
      created_at?: string | null;
    }>;
  }>;
};

function getRequiredCredentials() {
  if (
    !REAL_ACCOUNT_EMAIL ||
    !REAL_ACCOUNT_PASSWORD ||
    !ADMIN_EMAIL ||
    !ADMIN_PASSWORD
  ) {
    throw new Error(
      "Set E2E_REAL_ACCOUNT_EMAIL, E2E_REAL_ACCOUNT_PASSWORD, E2E_ADMIN_EMAIL, and E2E_ADMIN_PASSWORD to run the real order lifecycle test.",
    );
  }

  return {
    customerEmail: REAL_ACCOUNT_EMAIL,
    customerPassword: REAL_ACCOUNT_PASSWORD,
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
  };
}

async function adminLogin(email: string, password: string): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Admin login failed (${response.status})`);
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

async function adminFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Admin API ${options.method || "GET"} ${path} failed (${response.status}): ${body}`,
    );
  }

  return response;
}

async function getAdminOrder(
  orderId: string,
  token: string,
): Promise<AdminOrder> {
  const response = await adminFetch(
    `/admin/orders/${orderId}?fields=id,display_id,status,payment_status,fulfillment_status,created_at,*items,*fulfillments,*payment_collections,*payment_collections.payments`,
    token,
  );

  const data = (await response.json()) as { order: AdminOrder };
  return data.order;
}

async function createFulfillment(
  order: AdminOrder,
  token: string,
): Promise<AdminOrder> {
  const response = await adminFetch(
    `/admin/orders/${order.id}/fulfillments`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        items: (order.items || []).map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
        no_notification: true,
      }),
    },
  );

  const data = (await response.json()) as { order: AdminOrder };
  return data.order;
}

async function createShipment(
  order: AdminOrder,
  fulfillmentId: string,
  token: string,
): Promise<AdminOrder> {
  const response = await adminFetch(
    `/admin/orders/${order.id}/fulfillments/${fulfillmentId}/shipments`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        items: (order.items || []).map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
        labels: [],
        no_notification: true,
      }),
    },
  );

  const data = (await response.json()) as { order: AdminOrder };
  return data.order;
}

async function markFulfillmentDelivered(
  orderId: string,
  fulfillmentId: string,
  token: string,
): Promise<AdminOrder> {
  const response = await adminFetch(
    `/admin/orders/${orderId}/fulfillments/${fulfillmentId}/mark-as-delivered`,
    token,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  const data = (await response.json()) as { order: AdminOrder };
  return data.order;
}

async function createRealOrder(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
): Promise<string> {
  await loginThroughAccountPage(page, email, password);
  await addToCartAndCheckout(page);

  const addressField = page.locator(sel.ADDR_FIRST_NAME);
  const signedInText = page.locator(sel.SIGNED_IN_AS);
  await expect(signedInText.or(addressField)).toBeVisible({
    timeout: 15_000,
  });

  await page.locator(sel.ADDR_FIRST_NAME).fill(TEST_ADDRESS.first_name);
  await page.locator(sel.ADDR_LAST_NAME).fill(TEST_ADDRESS.last_name);
  await page.locator(sel.ADDR_ADDRESS1).fill(TEST_ADDRESS.address_1);
  await page.locator(sel.ADDR_CITY).fill(TEST_ADDRESS.city);
  await page.locator(sel.ADDR_PROVINCE).fill(TEST_ADDRESS.province);
  await page.locator(sel.ADDR_POSTAL_CODE).fill(TEST_ADDRESS.postal_code);
  await page.locator(sel.ADDR_COUNTRY).selectOption(TEST_ADDRESS.country_code);
  await page.locator(sel.CHECKOUT_CONTINUE_BUTTON).click();

  await selectShippingOption(page);
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible({
    timeout: 15_000,
  });

  await fillStripeCard(page);
  const paymentContinue = page.locator(sel.PAYMENT_CONTINUE_BUTTON);
  await expect(paymentContinue).toBeEnabled({ timeout: 15_000 });
  await paymentContinue.click();

  await expect(page.locator(sel.CHECKOUT_REVIEW_CONTACT_DT)).toBeVisible({
    timeout: 10_000,
  });
  const placeOrderButton = page.locator(sel.PLACE_ORDER_BUTTON);
  await expect(placeOrderButton).toBeVisible();
  await placeOrderButton.click();

  await page.waitForURL("**/order/confirmed/**", { timeout: 60_000 });
  await expect(
    page.locator('p:has-text("Your order is confirmed")'),
  ).toBeVisible({ timeout: 15_000 });

  const orderId = page.url().match(/\/order\/confirmed\/([^/?#]+)/)?.[1];
  if (!orderId) {
    throw new Error("Could not determine order ID from confirmation URL");
  }

  return orderId;
}

async function assertStorefrontProgress(
  page: import("@playwright/test").Page,
  orderId: string,
  expectedLabel: string,
  expectedStep: number,
) {
  await expect
    .poll(
      async () => {
        await page.goto(`/account/orders/${orderId}`);
        await page.waitForLoadState("networkidle");

        const statusText = await page
          .locator(
            "section[aria-labelledby='products-heading'] p.mt-6.font-medium.text-gray-900",
          )
          .first()
          .textContent();

        const activeLabels = await page
          .locator(".hidden.grid-cols-4 div.text-primary-600")
          .count();

        return JSON.stringify({
          statusText: statusText?.trim() || "",
          activeLabels,
        });
      },
      { timeout: 45_000, intervals: [1_000, 2_000, 5_000] },
    )
    .toBe(
      JSON.stringify({
        statusText: expectedLabel,
        activeLabels: expectedStep + 1,
      }),
    );
}

test.describe("Order status lifecycle", () => {
  test.skip(
    !REAL_ACCOUNT_EMAIL ||
      !REAL_ACCOUNT_PASSWORD ||
      !ADMIN_EMAIL ||
      !ADMIN_PASSWORD,
    "requires real customer/admin credentials in environment variables",
  );

  test("tracks checkout, fulfillment, shipment, and delivery state changes", async ({
    browser,
  }) => {
    const credentials = getRequiredCredentials();
    const customerContext = await browser.newContext({
      baseURL: "http://localhost:3000",
    });
    const customerPage = await customerContext.newPage();

    const orderId = await createRealOrder(
      customerPage,
      credentials.customerEmail,
      credentials.customerPassword,
    );

    const adminToken = await adminLogin(
      credentials.adminEmail,
      credentials.adminPassword,
    );

    let adminOrder = await getAdminOrder(orderId, adminToken);
    const initialProgress = deriveCustomerOrderProgress(adminOrder);
    if (!initialProgress.label || initialProgress.step === null) {
      throw new Error("Initial order progress should not be canceled");
    }

    await assertStorefrontProgress(
      customerPage,
      orderId,
      initialProgress.label,
      initialProgress.step,
    );

    adminOrder = await createFulfillment(adminOrder, adminToken);
    const fulfillmentId = adminOrder.fulfillments?.[0]?.id;
    if (!fulfillmentId) {
      throw new Error("Expected fulfillment to be created");
    }

    await assertStorefrontProgress(customerPage, orderId, "Processing", 1);

    adminOrder = await createShipment(adminOrder, fulfillmentId, adminToken);
    await assertStorefrontProgress(customerPage, orderId, "Shipped", 2);

    await markFulfillmentDelivered(orderId, fulfillmentId, adminToken);
    await assertStorefrontProgress(customerPage, orderId, "Delivered", 3);

    await customerContext.close();
  });
});
