import { test, expect } from "@playwright/test";
import { openFirstProductFromSearch } from "../helpers/product-flow";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("Storefront smoke", () => {
  // Catches CSP violations on the home page — a CSP nonce/caching mismatch
  // blocks ALL scripts, breaking hydration and interactive components.
  // Re-enable CSP in proxy.ts (currently disabled for debugging) and verify
  // this test stays green before shipping.
  test("home page has no CSP violations", async ({ page }) => {
    const cspViolations: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (
        msg.type() === "error" &&
        text.toLowerCase().includes("content security policy")
      ) {
        cspViolations.push(text);
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(
      cspViolations,
      `CSP violations detected:\n${cspViolations.join("\n")}`,
    ).toHaveLength(0);
  });

  test("home page and product detail page load", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();

    const productHref = await openFirstProductFromSearch(page);
    const escapedProductHref = escapeRegex(productHref);

    await expect(page).toHaveURL(new RegExp(`${escapedProductHref}(\\?.*)?$`));
    await expect(
      page.locator(
        'button[aria-label="Add to cart"], button[aria-label="Please select an option"]',
      ),
    ).toBeVisible({ timeout: 15_000 });
  });
});
