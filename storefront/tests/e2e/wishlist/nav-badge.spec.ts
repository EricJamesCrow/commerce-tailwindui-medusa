import { test, expect } from "../fixtures/wishlist.fixture";
import * as sel from "../helpers/selectors";

test.describe("Nav Wishlist Badge", () => {
  test("heart icon visible in header for authenticated user", async ({
    authedPage: page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const navHeart = page.locator(sel.NAV_WISHLIST_LINK);
    await expect(navHeart).toBeVisible({ timeout: 10_000 });
  });

  test("nav badge links to wishlist page", async ({ authedPage: page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.locator(sel.NAV_WISHLIST_LINK).click();
    await page.waitForURL("**/account/wishlist", { timeout: 10_000 });
  });

  test("nav badge shows count when items exist", async ({
    authedPage: page,
    populatedWishlist,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const navHeart = page.locator(sel.NAV_WISHLIST_LINK);
    await expect(navHeart).toBeVisible({ timeout: 10_000 });

    // populatedWishlist has 2 items — count should be visible
    const countText = navHeart.locator("span[aria-hidden='true']");
    await expect(countText).toBeVisible({ timeout: 10_000 });
    const text = await countText.textContent();
    expect(Number(text?.trim())).toBeGreaterThan(0);
  });

  test("nav badge updates after adding to wishlist", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    // Navigate to PDP and add to wishlist
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    const heart = page.locator(sel.HEART_ADD).first();
    await expect(heart).toBeVisible({ timeout: 10_000 });
    await heart.click();

    // Wait for the heart to toggle to solid (remove state)
    await expect(page.locator(sel.HEART_REMOVE).first()).toBeVisible({
      timeout: 10_000,
    });

    // Reload to see updated nav count
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const navHeart = page.locator(sel.NAV_WISHLIST_LINK);
    await expect(navHeart).toBeVisible({ timeout: 10_000 });

    // Should now have a count badge
    const countText = navHeart.locator("span[aria-hidden='true']");
    await expect(countText).toBeVisible({ timeout: 10_000 });
  });
});
