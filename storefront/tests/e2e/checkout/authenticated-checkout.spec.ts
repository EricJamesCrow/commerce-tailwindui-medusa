import {
  test,
  expect,
  TEST_ADDRESS,
  fillStripeCard,
  selectShippingOption,
} from "../fixtures/checkout.fixture";
import * as sel from "../helpers/selectors";

test.describe("Authenticated Checkout Flow", () => {
  test("complete checkout as logged-in customer", async ({
    authedCheckoutPage: page,
  }) => {
    // ---------------------------------------------------------------
    // Step 1: Email — auto-completes for authenticated users
    // ---------------------------------------------------------------
    // The email step should auto-set from the customer's account email
    // and advance to the next step. Check for "Signed in as" or that
    // the address step is already visible.
    const signedInText = page.locator(sel.SIGNED_IN_AS);
    const addressField = page.locator(sel.ADDR_FIRST_NAME);

    // Wait for either: "Signed in as" visible (step still showing) or address step active
    await expect(signedInText.or(addressField)).toBeVisible({
      timeout: 15_000,
    });

    // If email step hasn't auto-advanced yet, wait for address step
    if (!(await addressField.isVisible().catch(() => false))) {
      await expect(addressField).toBeVisible({ timeout: 15_000 });
    }

    // ---------------------------------------------------------------
    // Step 2: Shipping Address
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Step 3: Shipping Method
    // ---------------------------------------------------------------
    await selectShippingOption(page);

    // Wait for payment step to become active
    await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible({
      timeout: 15_000,
    });

    // ---------------------------------------------------------------
    // Step 4: Payment
    // ---------------------------------------------------------------
    await fillStripeCard(page);

    const paymentContinue = page.locator(sel.PAYMENT_CONTINUE_BUTTON);
    await expect(paymentContinue).toBeEnabled({ timeout: 15_000 });
    await paymentContinue.click();

    // ---------------------------------------------------------------
    // Step 5: Review & Place Order
    // ---------------------------------------------------------------
    await expect(page.locator(sel.CHECKOUT_REVIEW_CONTACT_DT)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(sel.CHECKOUT_REVIEW_SHIP_TO_DT)).toBeVisible();

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
  });
});
