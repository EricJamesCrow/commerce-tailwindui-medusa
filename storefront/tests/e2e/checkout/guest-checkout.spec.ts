import {
  test,
  expect,
  TEST_ADDRESS,
  fillStripeCard,
  selectShippingOption,
} from "../fixtures/checkout.fixture";
import * as sel from "../helpers/selectors";

test.describe("Guest Checkout Flow", () => {
  test("complete full guest checkout with Stripe", async ({
    guestCheckoutPage: page,
  }) => {
    // ---------------------------------------------------------------
    // Step 1: Email
    // ---------------------------------------------------------------
    const testEmail = `guest-e2e-${Date.now()}@test.local`;

    await expect(page.locator(sel.CHECKOUT_EMAIL_INPUT)).toBeVisible({
      timeout: 15_000,
    });
    await page.locator(sel.CHECKOUT_EMAIL_INPUT).fill(testEmail);
    await page.locator(sel.CHECKOUT_CONTINUE_BUTTON).click();

    // Wait for email step to collapse (summary shows email)
    await expect(page.locator(`p:has-text("${testEmail}")`)).toBeVisible({
      timeout: 10_000,
    });

    // ---------------------------------------------------------------
    // Step 2: Shipping Address
    // ---------------------------------------------------------------
    await expect(page.locator(sel.ADDR_FIRST_NAME)).toBeVisible({
      timeout: 10_000,
    });

    await page.locator(sel.ADDR_FIRST_NAME).fill(TEST_ADDRESS.first_name);
    await page.locator(sel.ADDR_LAST_NAME).fill(TEST_ADDRESS.last_name);
    await page.locator(sel.ADDR_ADDRESS1).fill(TEST_ADDRESS.address_1);
    await page.locator(sel.ADDR_CITY).fill(TEST_ADDRESS.city);
    await page.locator(sel.ADDR_PROVINCE).fill(TEST_ADDRESS.province);
    await page.locator(sel.ADDR_POSTAL_CODE).fill(TEST_ADDRESS.postal_code);

    // Select country
    await page
      .locator(sel.ADDR_COUNTRY)
      .selectOption(TEST_ADDRESS.country_code);

    // Click Continue for address step
    await page.locator(sel.CHECKOUT_CONTINUE_BUTTON).click();

    // ---------------------------------------------------------------
    // Step 3: Shipping Method
    // ---------------------------------------------------------------
    // Wait for shipping options to load, then select
    // (handles the pre-checked radio edge case)
    await selectShippingOption(page);

    // Wait for payment step to become active
    await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible({
      timeout: 15_000,
    });

    // ---------------------------------------------------------------
    // Step 4: Payment
    // ---------------------------------------------------------------
    // Fill Stripe PaymentElement card fields (handles iframe detection)
    await fillStripeCard(page);

    // Wait for the "Continue to review" button to become enabled
    const paymentContinue = page.locator(sel.PAYMENT_CONTINUE_BUTTON);
    await expect(paymentContinue).toBeEnabled({ timeout: 15_000 });
    await paymentContinue.click();

    // ---------------------------------------------------------------
    // Step 5: Review & Place Order
    // ---------------------------------------------------------------
    // Verify review summary shows correct data
    await expect(page.locator(sel.CHECKOUT_REVIEW_CONTACT_DT)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(sel.CHECKOUT_REVIEW_SHIP_TO_DT)).toBeVisible();
    await expect(page.locator(sel.CHECKOUT_REVIEW_PAYMENT_DT)).toBeVisible();

    // Verify email is shown in the review
    await expect(page.locator(`dd:has-text("${testEmail}")`)).toBeVisible();

    // Click Place Order
    const placeOrderButton = page.locator(sel.PLACE_ORDER_BUTTON);
    await expect(placeOrderButton).toBeVisible();
    await placeOrderButton.click();

    // ---------------------------------------------------------------
    // Order Confirmation
    // ---------------------------------------------------------------
    await page.waitForURL("**/order/confirmed/**", { timeout: 60_000 });

    await expect(page.locator(sel.ORDER_CONFIRMED_HEADING)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(sel.ORDER_CONFIRMED_SUBTITLE)).toBeVisible();
    await expect(page.locator(sel.CONTINUE_SHOPPING_LINK)).toBeVisible();
  });
});
