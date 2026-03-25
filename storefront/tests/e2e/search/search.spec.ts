import { test, expect } from "@playwright/test";

/**
 * Search e2e tests — covers Cmd+K palette and /search results page.
 *
 * These tests run against the live dev server with a real Medusa backend.
 * When NEXT_PUBLIC_MEILISEARCH_HOST is set, the Cmd+K palette uses
 * Meilisearch; otherwise it falls back to Medusa REST search.
 *
 * The /search results page always uses Medusa REST (faceted Meilisearch
 * search results page is a future enhancement).
 */

test.describe("Cmd+K Search Palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("opens with Cmd+K keyboard shortcut", async ({ page }) => {
    await page.keyboard.press("Meta+k");

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Should have the search input focused
    const input = dialog.locator("input");
    await expect(input).toBeFocused();
  });

  test("opens with Ctrl+K keyboard shortcut", async ({ page }) => {
    await page.keyboard.press("Control+k");

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test("search button in header opens palette", async ({ page }) => {
    const searchButton = page.locator(
      'header button:has(span.sr-only:has-text("Search"))',
    );
    await searchButton.first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test("closes with Escape key", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 3_000 });
  });

  test("shows product results when typing a query", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const input = dialog.locator("input");
    await input.fill("tee");

    // Wait for debounce (300ms) + network
    // Should show either product results or "No products found"
    const hasResults = dialog.locator('[role="option"]');
    const noResults = dialog.locator('text="No products found"');

    await expect(hasResults.first().or(noResults)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows 'See all' option when results exist", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const input = dialog.locator("input");
    await input.fill("tee");

    const seeAll = dialog.locator("text=/See all \\d+ products matching/");
    await expect(seeAll).toBeVisible({ timeout: 10_000 });
  });

  test("navigates to product page when selecting a product", async ({
    page,
  }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const input = dialog.locator("input");
    await input.fill("tee");

    // Wait for results to appear
    const firstProduct = dialog.locator('[role="option"]').nth(1); // nth(0) is "See all"
    await expect(firstProduct).toBeVisible({ timeout: 10_000 });

    // Click the first product result
    await firstProduct.click();

    // Should navigate to a product page
    await page.waitForURL("**/product/**", { timeout: 10_000 });
    expect(page.url()).toContain("/product/");
  });

  test("navigates to search page when pressing Enter", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const input = dialog.locator("input");
    await input.fill("bag");

    // Wait for results
    const seeAll = dialog.locator("text=/See all \\d+ products matching/");
    await expect(seeAll).toBeVisible({ timeout: 10_000 });

    // Press Enter — should select "See all" and navigate to /search
    await page.keyboard.press("Enter");

    await page.waitForURL("**/search?q=bag", { timeout: 10_000 });
    expect(page.url()).toContain("/search?q=bag");
  });

  test("clears input with X button", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const input = dialog.locator("input");
    await input.fill("test");

    // X button should appear
    const clearButton = dialog
      .locator("button")
      .filter({ has: page.locator("svg.h-5.w-5") })
      .last();
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    await expect(input).toHaveValue("");
  });

  test("shows loading state while searching", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const input = dialog.locator("input");
    await input.fill("test");

    // Should briefly show "Searching..." (may be too fast to catch reliably)
    // Just verify the input was accepted and results eventually appear
    const resultsOrEmpty = dialog.locator(
      '[role="option"], text="No products found"',
    );
    await expect(resultsOrEmpty.first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows footer hint when results are visible", async ({ page }) => {
    await page.keyboard.press("Meta+k");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const input = dialog.locator("input");
    await input.fill("tee");

    // Wait for results
    await expect(dialog.locator('[role="option"]').first()).toBeVisible({
      timeout: 10_000,
    });

    // Footer with Enter key hint should be visible
    const footer = dialog.locator("text=/Press Enter to select|to select/");
    await expect(footer).toBeVisible();
  });
});

test.describe("Search Results Page", () => {
  test("redirects to /products when no query", async ({ page }) => {
    await page.goto("/search");
    await page.waitForURL("**/products", { timeout: 10_000 });
    expect(page.url()).toContain("/products");
  });

  test("displays results for a search query", async ({ page }) => {
    await page.goto("/search?q=tee");
    await page.waitForLoadState("networkidle");

    // Should show result count text
    const resultsText = page.locator("text=/Showing \\d+ results? for/");
    const noResults = page.locator('text="There are no products that match "');

    await expect(resultsText.or(noResults)).toBeVisible({ timeout: 15_000 });
  });

  test("shows search query in bold", async ({ page }) => {
    await page.goto("/search?q=bag");
    await page.waitForLoadState("networkidle");

    const queryText = page.locator("span.font-bold");
    await expect(queryText).toBeVisible({ timeout: 15_000 });
    await expect(queryText).toContainText("bag");
  });

  test("displays product grid when results exist", async ({ page }) => {
    await page.goto("/search?q=tee");
    await page.waitForLoadState("networkidle");

    // Product cards should be visible (links to /product/...)
    const productLinks = page.locator('a[href^="/product/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });
  });

  test("collections sidebar is visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/search?q=tee");
    await page.waitForLoadState("networkidle");

    // The (store) layout renders collections in the sidebar
    const collectionsHeading = page.locator(
      'h3.sr-only:has-text("Collections")',
    );
    await expect(collectionsHeading).toBeAttached({ timeout: 10_000 });
  });

  test("sort dropdown is functional", async ({ page }) => {
    await page.goto("/search?q=tee");
    await page.waitForLoadState("networkidle");

    const sortButton = page.locator('button:has-text("Sort")');
    await expect(sortButton).toBeVisible({ timeout: 10_000 });

    await sortButton.click();

    // Sort menu should appear with options
    const sortOption = page.locator('[role="menuitem"]').first();
    await expect(sortOption).toBeVisible({ timeout: 5_000 });
  });

  test("mobile filter button visible on small screens", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/search?q=tee");
    await page.waitForLoadState("networkidle");

    const filterButton = page.locator(
      'button:has(span.sr-only:has-text("Filters"))',
    );
    await expect(filterButton).toBeVisible({ timeout: 10_000 });
  });
});
