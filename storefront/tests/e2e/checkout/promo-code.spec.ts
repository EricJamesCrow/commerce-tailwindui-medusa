// storefront/tests/e2e/checkout/promo-code.spec.ts
import { test, expect } from "../fixtures/checkout.fixture";
import * as sel from "../helpers/selectors";

// A valid promotion code that must exist in the Medusa admin.
// Create it before running: code = TESTDISCOUNT10, 10% off, no restrictions.
const VALID_PROMO_CODE = "TESTDISCOUNT10";
const INVALID_PROMO_CODE = "THISDOESNOTEXIST999";

test.describe("Promo Code Input", () => {
  test("promo code toggle is visible on checkout", async ({
    guestCheckoutPage: page,
  }) => {
    await expect(
      page.locator(sel.ORDER_SUMMARY_ITEM).first(),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.locator(sel.PROMO_CODE_TOGGLE)).toBeVisible();
  });

  test("clicking toggle reveals the promo code input", async ({
    guestCheckoutPage: page,
  }) => {
    await expect(
      page.locator(sel.ORDER_SUMMARY_ITEM).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Input should be hidden initially
    await expect(page.locator(sel.PROMO_CODE_INPUT)).not.toBeVisible();

    // Click toggle to reveal
    await page.locator(sel.PROMO_CODE_TOGGLE).click();
    await expect(page.locator(sel.PROMO_CODE_INPUT)).toBeVisible();
  });

  test("applying an invalid code shows an inline error", async ({
    guestCheckoutPage: page,
  }) => {
    await expect(
      page.locator(sel.ORDER_SUMMARY_ITEM).first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.locator(sel.PROMO_CODE_TOGGLE).click();
    await page.locator(sel.PROMO_CODE_INPUT).fill(INVALID_PROMO_CODE);
    await page.locator(sel.PROMO_CODE_APPLY_BUTTON).click();

    await expect(page.locator(sel.PROMO_CODE_ERROR)).toBeVisible({
      timeout: 10_000,
    });
    // No chip should appear for an invalid code
    await expect(
      page.locator(sel.PROMO_CODE_CHIP(INVALID_PROMO_CODE)),
    ).not.toBeVisible();
  });

  test("applying a valid code shows a chip and clears the input", async ({
    guestCheckoutPage: page,
  }) => {
    await expect(
      page.locator(sel.ORDER_SUMMARY_ITEM).first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.locator(sel.PROMO_CODE_TOGGLE).click();
    await page.locator(sel.PROMO_CODE_INPUT).fill(VALID_PROMO_CODE);
    await page.locator(sel.PROMO_CODE_APPLY_BUTTON).click();

    // Chip appears
    await expect(
      page.locator(sel.PROMO_CODE_CHIP(VALID_PROMO_CODE)),
    ).toBeVisible({ timeout: 10_000 });

    // Input is cleared
    await expect(page.locator(sel.PROMO_CODE_INPUT)).toHaveValue("");

    // No error shown
    await expect(page.locator(sel.PROMO_CODE_ERROR)).not.toBeVisible();
  });

  test("removing an applied code removes the chip", async ({
    guestCheckoutPage: page,
  }) => {
    await expect(
      page.locator(sel.ORDER_SUMMARY_ITEM).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Apply first
    await page.locator(sel.PROMO_CODE_TOGGLE).click();
    await page.locator(sel.PROMO_CODE_INPUT).fill(VALID_PROMO_CODE);
    await page.locator(sel.PROMO_CODE_APPLY_BUTTON).click();
    await expect(
      page.locator(sel.PROMO_CODE_CHIP(VALID_PROMO_CODE)),
    ).toBeVisible({ timeout: 10_000 });

    // Then remove
    await page.locator(sel.PROMO_CODE_REMOVE_BUTTON(VALID_PROMO_CODE)).click();
    await expect(
      page.locator(sel.PROMO_CODE_CHIP(VALID_PROMO_CODE)),
    ).not.toBeVisible({ timeout: 10_000 });
  });
});
