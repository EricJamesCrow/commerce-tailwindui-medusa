import {
  test,
  expect,
  TEST_ADDRESS,
  fillStripeCard,
  selectShippingOption,
} from "../fixtures/checkout.fixture";
import * as sel from "../helpers/selectors";

test.setTimeout(180_000);

/**
 * Order Detail Page E2E Tests
 *
 * These tests create a real order via the checkout flow, then navigate
 * to the order detail page and verify all sections render correctly:
 * - Order header (number, date, back link)
 * - Product items with large images
 * - Progress bar at step 0 (Order placed) — the default for new orders
 * - Delivery address and shipping method
 * - Billing summary (address, payment card info, pricing breakdown)
 * - "View Order" links on the order card list
 */

test.describe("Order Detail Page", () => {
  test("navigates from order list to order detail and verifies all sections", async ({
    authedCheckoutPage: page,
  }) => {
    // ---------------------------------------------------------------
    // Step 1: Complete checkout to create an order
    // ---------------------------------------------------------------
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
    await page
      .locator(sel.ADDR_COUNTRY)
      .selectOption(TEST_ADDRESS.country_code);
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

    // Wait for order confirmation
    await page.waitForURL("**/order/confirmed/**", { timeout: 60_000 });
    await expect(
      page.locator('p:has-text("Your order is confirmed")'),
    ).toBeVisible({ timeout: 15_000 });

    // Capture the order display_id from the confirmation page
    const orderIdText = await page
      .locator('p:has-text("Order #")')
      .textContent();
    const displayId = orderIdText?.match(/#(\d+)/)?.[1];
    expect(displayId).toBeTruthy();

    // ---------------------------------------------------------------
    // Step 2: Navigate to order list
    // ---------------------------------------------------------------
    await page.goto("/account/orders");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Order History" }),
    ).toBeVisible({ timeout: 15_000 });

    // Verify order card appears with our order number
    const orderCard = page.locator(`text=#${displayId}`);
    await expect(orderCard).toBeVisible({ timeout: 10_000 });

    // ---------------------------------------------------------------
    // Step 3: Click "View Order" to navigate to detail page
    // ---------------------------------------------------------------
    const viewOrderLink = page.locator('a:has-text("View Order")').first();
    await expect(viewOrderLink).toBeVisible();
    await viewOrderLink.click();

    await page.waitForURL("**/account/orders/**", { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // ---------------------------------------------------------------
    // Step 4: Verify order detail page sections
    // ---------------------------------------------------------------

    // 4a: Back link
    const backLink = page.locator('a:has-text("Back to orders")');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute("href", "/account/orders");

    // 4b: Order header — number and date
    await expect(
      page.getByRole("heading", { name: "Order Details" }),
    ).toBeVisible();
    await expect(page.locator(`text=#${displayId}`)).toBeVisible();
    // Date should be present (formatted as a <time> element)
    await expect(page.locator("time")).toBeVisible();

    // 4c: Product section — at least one product item
    const productHeading = page.locator("#products-heading");
    await expect(productHeading).toBeAttached(); // sr-only heading

    // Product name, price, and quantity should be visible
    const productItem = page.locator(
      "section[aria-labelledby='products-heading'] .grid",
    );
    await expect(productItem.first()).toBeVisible();
    await expect(productItem.first().locator("h3")).toBeVisible();
    await expect(
      productItem.first().locator("text=/\\$[\\d,.]+/"),
    ).toBeVisible();
    await expect(productItem.first().locator("text=/Qty: \\d+/")).toBeVisible();

    // 4d: Delivery address
    await expect(page.locator('dt:has-text("Delivery address")')).toBeVisible();
    await expect(
      page.locator(`dd:has-text("${TEST_ADDRESS.first_name}")`),
    ).toBeVisible();
    await expect(
      page.locator(`dd:has-text("${TEST_ADDRESS.city}")`),
    ).toBeVisible();

    // 4e: Shipping method
    await expect(page.locator('dt:has-text("Shipping method")')).toBeVisible();

    // 4f: Progress bar — new order should be at step 0 (Order placed)
    const progressBar = page.locator(
      ".overflow-hidden.rounded-full.bg-gray-200",
    );
    await expect(progressBar).toBeVisible();

    // The inner bar should have a width > 0 (at least step 0)
    const innerBar = progressBar.locator(".bg-primary-600");
    await expect(innerBar).toBeVisible();
    const width = await innerBar.evaluate((el) => el.style.width);
    expect(width).toBeTruthy();

    // Progress step labels (desktop only — sm:grid)
    const progressLabels = page.locator(".hidden.grid-cols-4 div");
    // On desktop viewport, all 4 labels should be present
    const labelCount = await progressLabels.count();
    expect(labelCount).toBe(4);

    // "Order placed" label should be highlighted (text-primary-600)
    const orderPlacedLabel = progressLabels.first();
    await expect(orderPlacedLabel).toHaveText("Order placed");
    await expect(orderPlacedLabel).toHaveClass(/text-primary-600/);

    // Status text above progress bar
    await expect(page.locator('text="Order placed"').first()).toBeVisible();

    // 4g: Billing summary section
    await expect(page.locator('dt:has-text("Billing address")')).toBeVisible();
    await expect(
      page.locator('dt:has-text("Payment information")'),
    ).toBeVisible();

    // Card info — should show "Ending with 4242" (Stripe test card)
    await expect(page.locator('text="Ending with 4242"')).toBeVisible();

    // Pricing breakdown
    await expect(page.locator('dt:has-text("Subtotal")')).toBeVisible();
    await expect(page.locator('dt:has-text("Shipping")')).toBeVisible();
    await expect(page.locator('dt:has-text("Tax")')).toBeVisible();
    await expect(page.locator('dt:has-text("Order total")')).toBeVisible();

    // Order total should show a dollar amount
    const totalRow = page.locator('dt:has-text("Order total") + dd');
    await expect(totalRow).toHaveText(/\$[\d,.]+/);

    // ---------------------------------------------------------------
    // Step 5: Verify back link navigation
    // ---------------------------------------------------------------
    await backLink.click();
    await page.waitForURL("**/account/orders", { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: "Order History" }),
    ).toBeVisible();
  });
});
