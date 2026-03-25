import { test, expect } from "../fixtures/wishlist.fixture";
import * as sel from "../helpers/selectors";

test.describe("Authenticated Wishlist", () => {
  test("can create a new named wishlist", async ({
    authedPage: page,
    populatedWishlist,
  }) => {
    // Need an existing wishlist — empty state doesn't show "New Wishlist" button
    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    await page.locator(sel.NEW_WISHLIST_BUTTON).click();
    await page.locator(sel.WISHLIST_NAME_INPUT).fill("Gift Ideas");
    await page.locator(sel.CREATE_BUTTON).click();

    await expect(page.getByText("Gift Ideas")).toBeVisible({ timeout: 10_000 });
  });

  test("shows wishlist items with product info", async ({
    authedPage: page,
    populatedWishlist,
  }) => {
    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    const items = page.locator(sel.REMOVE_ITEM_BUTTON);
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    const cartButtons = page.locator(sel.ADD_TO_CART_BUTTON);
    await expect(cartButtons.first()).toBeVisible();
  });

  test("can remove item from wishlist", async ({
    authedPage: page,
    populatedWishlist,
  }) => {
    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    const removeButtons = page.locator(sel.REMOVE_ITEM_BUTTON);
    const initialCount = await removeButtons.count();
    expect(initialCount).toBeGreaterThan(0);

    await removeButtons.first().click();

    await expect(removeButtons).toHaveCount(initialCount - 1, {
      timeout: 10_000,
    });
  });

  test("can switch between multiple wishlists", async ({
    authedPage: page,
    api,
    populatedWishlist,
  }) => {
    const second = await api.createWishlist("Second List");

    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.WISHLIST_TABS)).toBeVisible({
      timeout: 10_000,
    });

    const tabs = page.locator(sel.WISHLIST_TAB);
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);

    await tabs.nth(1).click();

    await expect(page.getByText("Second List").first()).toBeVisible();

    try {
      await api.deleteWishlist(second.id);
    } catch {
      // best-effort
    }
  });

  test("shows empty state when wishlist has no items", async ({
    authedPage: page,
    api,
  }) => {
    const wl = await api.createWishlist("Empty Wishlist");

    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    const emptyTab = page.getByText("Empty Wishlist");
    if (await emptyTab.isVisible()) {
      await emptyTab.click();
    }

    await expect(page.locator(sel.EMPTY_STATE_HEADING)).toBeVisible({
      timeout: 10_000,
    });

    try {
      await api.deleteWishlist(wl.id);
    } catch {
      // best-effort
    }
  });

  test("add to cart from wishlist works", async ({
    authedPage: page,
    populatedWishlist,
  }) => {
    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    const addToCartBtn = page.locator(sel.ADD_TO_CART_BUTTON).first();
    await expect(addToCartBtn).toBeVisible({ timeout: 10_000 });
    await addToCartBtn.click();

    await expect(addToCartBtn).not.toHaveText("Adding...", {
      timeout: 15_000,
    });
  });

  test("can generate share link", async ({
    authedPage: page,
    populatedWishlist,
  }) => {
    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    const shareBtn = page.locator(sel.SHARE_BUTTON);
    await expect(shareBtn).toBeVisible({ timeout: 10_000 });
    await shareBtn.click();

    await expect(shareBtn).not.toHaveText("Sharing...", { timeout: 10_000 });
  });
});
