import { test, expect } from "../fixtures/checkout.fixture";
import * as sel from "../helpers/selectors";

test.describe("Order Summary Actions", () => {
  test("each item has an Edit link pointing to /product/{handle}", async ({
    guestCheckoutPage: page,
  }) => {
    // Wait for at least one order summary item to render
    await expect(page.locator(sel.ORDER_SUMMARY_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });

    const editLinks = page.locator(sel.ORDER_SUMMARY_EDIT_LINK);
    const count = await editLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify each Edit link has an href that includes /product/
    for (let i = 0; i < count; i++) {
      const href = await editLinks.nth(i).getAttribute("href");
      expect(href).toMatch(/\/product\/.+/);
    }
  });

  test("each item has a Remove button", async ({ guestCheckoutPage: page }) => {
    // Wait for at least one order summary item to render
    await expect(page.locator(sel.ORDER_SUMMARY_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });

    const removeButtons = page.locator(sel.ORDER_SUMMARY_REMOVE_BUTTON);
    await expect(removeButtons.first()).toBeVisible({ timeout: 10_000 });
    const count = await removeButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("clicking Remove removes the item from order summary", async ({
    guestCheckoutPage: page,
  }) => {
    // Wait for at least one order summary item to render
    await expect(page.locator(sel.ORDER_SUMMARY_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });

    const items = page.locator(sel.ORDER_SUMMARY_ITEM);
    const initialCount = await items.count();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Click the first Remove button
    const removeButton = page.locator(sel.ORDER_SUMMARY_REMOVE_BUTTON).first();
    await expect(removeButton).toBeVisible({ timeout: 10_000 });
    await removeButton.click();

    // If this was the only item, we should redirect away from checkout
    if (initialCount === 1) {
      await page.waitForURL((url) => !url.pathname.includes("/checkout"), {
        timeout: 15_000,
      });
    } else {
      // Otherwise, one fewer item in the list
      await expect(items).toHaveCount(initialCount - 1, { timeout: 10_000 });
    }
  });
});
