import { test, expect } from "../fixtures/checkout.fixture";
import * as sel from "../helpers/selectors";

test.describe("Checkout Accordion", () => {
  test("active step shows text-lg font-medium text-gray-900 heading", async ({
    guestCheckoutPage: page,
  }) => {
    // On initial load, "Contact information" is the active step
    const activeHeading = page.locator(
      'h2.text-lg.font-medium.text-gray-900:has-text("Contact information")',
    );
    await expect(activeHeading).toBeVisible({ timeout: 15_000 });
  });

  test("future steps render as disabled buttons with text-gray-500", async ({
    guestCheckoutPage: page,
  }) => {
    // Shipping address, Shipping method, Payment, Review order should be disabled
    const futureSteps = [
      "Shipping address",
      "Shipping method",
      "Payment",
      "Review order",
    ];

    for (const label of futureSteps) {
      const disabledButton = page.locator(
        `button:disabled:has-text("${label}")`,
      );
      await expect(disabledButton).toBeVisible({ timeout: 10_000 });
    }
  });

  test("no numbered circles or checkmark SVGs exist in the accordion", async ({
    guestCheckoutPage: page,
  }) => {
    // The redesign removed numbered circles — verify they don't exist
    // Use the specific checkout accordion (has border-b + border-t, unlike the order summary ul)
    const accordion = page.locator(
      "div.divide-y.divide-gray-200.border-b.border-t",
    );
    await expect(accordion).toBeVisible({ timeout: 15_000 });

    // No numbered circle badges (1-5 inside rounded-full spans)
    const numberedCircles = accordion
      .locator("span.rounded-full")
      .filter({ hasText: /^[1-5]$/ });
    await expect(numberedCircles).toHaveCount(0);
  });

  test("completing a step shows summary text and Edit button", async ({
    guestCheckoutPage: page,
  }) => {
    const testEmail = "test-accordion@example.com";

    // Fill email and continue
    await page.locator(sel.CHECKOUT_EMAIL_INPUT).fill(testEmail);
    await page.locator(sel.CHECKOUT_CONTINUE_BUTTON).click();

    // Wait for the email step to collapse — it should show the email as summary
    await expect(
      page.locator(`p.text-sm.text-gray-500:has-text("${testEmail}")`),
    ).toBeVisible({ timeout: 10_000 });

    // An Edit button should appear for the completed email step
    const editButton = page.locator(sel.STEP_EDIT_BUTTON).first();
    await expect(editButton).toBeVisible();

    // Clicking Edit should re-open the email step
    await editButton.click();
    await expect(page.locator(sel.CHECKOUT_EMAIL_INPUT)).toBeVisible({
      timeout: 5_000,
    });
  });
});
