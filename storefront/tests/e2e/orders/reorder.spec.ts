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
 * Shared helper: complete checkout to create a real order, then navigate
 * to the order list page. Reused by both tests.
 */
async function completeCheckoutAndGoToOrders(
  page: import("@playwright/test").Page,
) {
  const addressField = page.locator(sel.ADDR_FIRST_NAME);
  const signedInText = page.locator(sel.SIGNED_IN_AS);
  await expect(signedInText.or(addressField)).toBeVisible({ timeout: 15_000 });

  await page.locator(sel.ADDR_FIRST_NAME).fill(TEST_ADDRESS.first_name);
  await page.locator(sel.ADDR_LAST_NAME).fill(TEST_ADDRESS.last_name);
  await page.locator(sel.ADDR_ADDRESS1).fill(TEST_ADDRESS.address_1);
  await page.locator(sel.ADDR_CITY).fill(TEST_ADDRESS.city);
  await page.locator(sel.ADDR_PROVINCE).fill(TEST_ADDRESS.province);
  await page.locator(sel.ADDR_POSTAL_CODE).fill(TEST_ADDRESS.postal_code);
  await page.locator(sel.ADDR_COUNTRY).selectOption(TEST_ADDRESS.country_code);
  await page.locator(sel.CHECKOUT_CONTINUE_BUTTON).click();
  await selectShippingOption(page);
  await fillStripeCard(page);
  await page.locator(sel.PLACE_ORDER_BUTTON).click();
  await expect(page).toHaveURL(/\/order\/confirmed\//, { timeout: 60_000 });

  await page.goto("/account/orders");
  await page.waitForLoadState("networkidle");
}

// Re-enable after checkout hardening restores the reorder happy path.
test.describe.skip("Reorder", () => {
  test("reorder from order list page redirects to checkout with cart populated", async ({
    authedCheckoutPage: page,
  }) => {
    await completeCheckoutAndGoToOrders(page);

    // Reorder button should be visible on the order card
    const reorderBtn = page.locator('button:has-text("Reorder")').first();
    await expect(reorderBtn).toBeVisible({ timeout: 15_000 });

    // Click reorder
    await reorderBtn.click();

    // Loading state should appear briefly
    await expect(
      page.locator('button:has-text("Reordering...")').first(),
    ).toBeVisible({ timeout: 5_000 });

    // Should redirect to /checkout with cart pre-populated
    await expect(page).toHaveURL("/checkout", { timeout: 30_000 });
    // Verify the cart is actually populated — the order summary must show at least one item
    await expect(page.locator(sel.ORDER_SUMMARY_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("reorder from order detail page redirects to checkout with cart populated", async ({
    authedCheckoutPage: page,
  }) => {
    await completeCheckoutAndGoToOrders(page);

    // Navigate to the order detail page
    const viewOrderLink = page.locator('a:has-text("View Order")').first();
    await expect(viewOrderLink).toBeVisible({ timeout: 15_000 });
    await viewOrderLink.click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/account\/orders\/order_/);

    // Reorder button should appear on the detail page
    const reorderBtn = page.locator('button:has-text("Reorder")').first();
    await expect(reorderBtn).toBeVisible({ timeout: 10_000 });

    // Click and verify checkout redirect with populated cart
    await reorderBtn.click();
    await expect(page).toHaveURL("/checkout", { timeout: 30_000 });
    await expect(page.locator(sel.ORDER_SUMMARY_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
