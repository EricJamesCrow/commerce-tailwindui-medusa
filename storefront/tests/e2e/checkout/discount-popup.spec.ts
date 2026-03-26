// storefront/tests/e2e/checkout/discount-popup.spec.ts
import { test, expect } from "@playwright/test";
import * as sel from "../helpers/selectors";

test.describe("Discount Popup", () => {
  test.beforeEach(async ({ page }) => {
    // Clear sessionStorage before each test so popup can appear
    await page.addInitScript(() => {
      sessionStorage.removeItem("discount_popup_shown");
    });
  });

  test("popup appears for unauthenticated visitors after a short delay", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.DISCOUNT_POPUP)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("dismissing the popup with the × button closes it", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.DISCOUNT_POPUP)).toBeVisible({
      timeout: 5_000,
    });
    await page.locator(sel.DISCOUNT_POPUP_DISMISS).click();
    await expect(page.locator(sel.DISCOUNT_POPUP)).not.toBeVisible({
      timeout: 3_000,
    });
  });

  test("dismissing with Maybe Later closes the popup", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.DISCOUNT_POPUP)).toBeVisible({
      timeout: 5_000,
    });
    await page.locator(sel.DISCOUNT_POPUP_MAYBE_LATER).click();
    await expect(page.locator(sel.DISCOUNT_POPUP)).not.toBeVisible({
      timeout: 3_000,
    });
  });

  test("popup does not reappear after dismissal within the same session", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.DISCOUNT_POPUP)).toBeVisible({
      timeout: 5_000,
    });
    await page.locator(sel.DISCOUNT_POPUP_DISMISS).click();

    // Navigate away and back
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Popup should NOT appear again (sessionStorage key is set)
    await page.waitForTimeout(1_500);
    await expect(page.locator(sel.DISCOUNT_POPUP)).not.toBeVisible();
  });

  test("Create an account CTA navigates to registration page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.DISCOUNT_POPUP)).toBeVisible({
      timeout: 5_000,
    });
    await page.locator(sel.DISCOUNT_POPUP_CREATE_ACCOUNT).click();
    await page.waitForURL("**/account/register**", { timeout: 10_000 });
    expect(page.url()).toContain("/account/register");
  });
});
