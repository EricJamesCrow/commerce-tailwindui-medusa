import { test, expect } from "../fixtures/wishlist.fixture";
import * as sel from "../helpers/selectors";

test.describe("Rename/Delete Wishlist", () => {
  test("actions menu opens with Rename and Delete options", async ({
    authedPage: page,
    populatedWishlist,
  }) => {
    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    // Click the ellipsis menu button
    const menuBtn = page.locator(sel.ACTIONS_MENU_BUTTON);
    await expect(menuBtn).toBeVisible({ timeout: 10_000 });
    await menuBtn.click();

    // Both menu items should be visible
    await expect(page.locator(sel.RENAME_MENU_ITEM)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(sel.DELETE_MENU_ITEM)).toBeVisible();
  });

  test("can rename a wishlist", async ({
    authedPage: page,
    populatedWishlist,
  }) => {
    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    // Open menu and click Rename
    await page.locator(sel.ACTIONS_MENU_BUTTON).click();
    await page.locator(sel.RENAME_MENU_ITEM).click();

    // Rename dialog should appear
    await expect(page.locator(sel.RENAME_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Clear and type new name
    const input = page.locator(sel.RENAME_INPUT);
    await input.clear();
    await input.fill("Renamed Wishlist");

    // Submit
    await page.locator(sel.RENAME_SUBMIT).click();

    // Dialog should close and new name should appear
    await expect(page.getByText("Renamed Wishlist").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("can delete a wishlist", async ({
    authedPage: page,
    api,
    populatedWishlist,
  }) => {
    // Create a second wishlist to delete (so we still have one left)
    const second = await api.createWishlist("Delete Me");

    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    // Switch to the second tab
    const tabs = page.locator(sel.WISHLIST_TAB);
    await expect(tabs).toHaveCount(2, { timeout: 10_000 });

    // Find and click the "Delete Me" tab
    const deleteTab = page.getByText("Delete Me").first();
    await expect(deleteTab).toBeVisible({ timeout: 10_000 });
    await deleteTab.click();

    // Open menu and click Delete
    await page.locator(sel.ACTIONS_MENU_BUTTON).click();
    await page.locator(sel.DELETE_MENU_ITEM).click();

    // Delete confirmation dialog should appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.locator(sel.DELETE_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });
    // Dialog should mention the wishlist name
    await expect(dialog.getByText("Delete Me").first()).toBeVisible();

    // Confirm delete via the dialog's Delete button
    await dialog.locator('button:has-text("Delete")').click();

    // Wait for the dialog to close (delete operation completes)
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    // Should switch back to "Test Wishlist" — heading confirms active wishlist
    await expect(page.locator("h2").getByText("Test Wishlist")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("rename dialog pre-fills current name", async ({
    authedPage: page,
    populatedWishlist,
  }) => {
    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    // Open rename dialog
    await page.locator(sel.ACTIONS_MENU_BUTTON).click();
    await page.locator(sel.RENAME_MENU_ITEM).click();

    await expect(page.locator(sel.RENAME_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Input should have current wishlist name
    const input = page.locator(sel.RENAME_INPUT);
    await expect(input).toHaveValue("Test Wishlist");
  });

  test("delete confirmation shows wishlist name", async ({
    authedPage: page,
    populatedWishlist,
  }) => {
    await page.goto("/account/wishlist");
    await page.waitForLoadState("networkidle");

    // Open delete dialog
    await page.locator(sel.ACTIONS_MENU_BUTTON).click();
    await page.locator(sel.DELETE_MENU_ITEM).click();

    await expect(page.locator(sel.DELETE_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Confirmation text should mention the wishlist name
    await expect(page.getByText(/Test Wishlist/).first()).toBeVisible();
  });
});
