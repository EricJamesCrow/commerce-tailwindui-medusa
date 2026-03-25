import { test, expect } from "../fixtures/auth.fixture";

/**
 * 404 Not Found Page E2E Tests
 *
 * Tests the global not-found.tsx page renders correctly with:
 * - Background image
 * - "404" text
 * - "Page not found" heading
 * - Subtitle text
 * - "Back to home" link that navigates to /
 *
 * Also tests that invalid order IDs trigger the 404 page
 * within the account/orders context for an authenticated customer.
 */

test.setTimeout(60_000);

test.describe("404 Page", () => {
  test("renders 404 page for a non-existent route", async ({ page }) => {
    await page.goto("/this-page-definitely-does-not-exist-abc123");
    await page.waitForLoadState("networkidle");

    // "404" text
    await expect(page.locator("text=404")).toBeVisible({ timeout: 10_000 });

    // "Page not found" heading
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();

    // Subtitle
    await expect(
      page.locator("text=Sorry, we couldn't find the page you're looking for."),
    ).toBeVisible();

    // "Back to home" link
    const backLink = page.locator('a:has-text("Back to home")');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute("href", "/");
  });

  test("background image is present", async ({ page }) => {
    await page.goto("/nonexistent-route-xyz");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=404")).toBeVisible({ timeout: 10_000 });

    // The background image should be a self-hosted asset.
    const bgImage = page.locator("main img");
    await expect(bgImage).toBeAttached();
    const src = await bgImage.getAttribute("src");
    expect(src).toBe("/images/404-background.svg");
  });

  test("'Back to home' link navigates to homepage", async ({ page }) => {
    await page.goto("/does-not-exist");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=404")).toBeVisible({ timeout: 10_000 });

    const backLink = page.locator('a:has-text("Back to home")');
    await backLink.click();

    await page.waitForURL("/", { timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    // Should be on the homepage now
    expect(page.url()).toMatch(/\/$/);
  });

  test("deeply nested non-existent route shows 404", async ({ page }) => {
    await page.goto("/collections/nonexistent/subcategory/also-fake");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=404")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });

  test("invalid order ID shows 404 within account", async ({
    authedPage: page,
  }) => {
    // Navigate to a fake order ID
    await page.goto("/account/orders/order_00000000000000000000000000");
    await page.waitForLoadState("networkidle");

    // Should show 404 since the order doesn't exist
    await expect(page.locator("text=404")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });

  test("non-UUID order ID shows 404", async ({ authedPage: page }) => {
    // Try with a completely invalid order ID format
    await page.goto("/account/orders/not-a-valid-id");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=404")).toBeVisible({ timeout: 15_000 });
  });

  test("page has correct structure and styling", async ({ page }) => {
    await page.goto("/nope");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=404")).toBeVisible({ timeout: 10_000 });

    // <main> should have isolate class for z-index stacking
    const main = page.locator("main.relative.isolate");
    await expect(main).toBeAttached();

    // White text should be visible (not hidden behind anything)
    const heading = page.getByRole("heading", { name: "Page not found" });
    await expect(heading).toBeVisible();

    // The heading should have white text
    const headingColor = await heading.evaluate(
      (el) => window.getComputedStyle(el).color,
    );
    // White = rgb(255, 255, 255)
    expect(headingColor).toBe("rgb(255, 255, 255)");
  });
});
