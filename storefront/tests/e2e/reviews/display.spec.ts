import { test, expect } from "../fixtures/review.fixture";
import * as sel from "../helpers/selectors";

/**
 * Helper: navigate to product page and ensure the reviews section loaded.
 * Retries with reload up to 3 times to overcome stale Next.js cache.
 */
async function gotoProductWithReviews(
  page: import("@playwright/test").Page,
  handle: string,
) {
  await page.goto(`/product/${handle}`);
  await page.waitForLoadState("networkidle");

  const heading = page.locator(sel.REVIEW_SECTION_HEADING);
  const reviewItem = page.locator(sel.REVIEW_LIST_ITEM).first();

  // Try up to 3 reloads to get fresh cached data with reviews
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await heading.waitFor({ state: "visible", timeout: 5_000 });
      await reviewItem.waitFor({ state: "visible", timeout: 5_000 });
      return; // Reviews loaded successfully
    } catch {
      await page.reload({ waitUntil: "networkidle" });
    }
  }

  // Final assertion with generous timeout
  await expect(heading).toBeVisible({ timeout: 15_000 });
  await expect(reviewItem).toBeVisible({ timeout: 10_000 });
}

test.describe("Review Display", () => {
  test("shows approved reviews on product page", async ({
    guestPage: page,
    approvedReview,
  }) => {
    await gotoProductWithReviews(page, approvedReview.productHandle);

    // Should show at least 1 review item
    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows review content and reviewer name", async ({
    guestPage: page,
    approvedReview,
  }) => {
    await gotoProductWithReviews(page, approvedReview.productHandle);

    // Wait for reviews to load
    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 10_000,
    });

    // Check for the review content we created in the fixture
    await expect(
      page.getByText("E2E test review", { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Check for reviewer name display (first_name + last initial)
    await expect(
      page.getByText("E2E T.", { exact: false }).first(),
    ).toBeVisible();
  });

  test("shows review title when present", async ({
    guestPage: page,
    approvedReview,
  }) => {
    await gotoProductWithReviews(page, approvedReview.productHandle);

    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 10_000,
    });

    await expect(
      page.getByText("Great product for testing").first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows star rating for reviews", async ({
    guestPage: page,
    approvedReview,
  }) => {
    await gotoProductWithReviews(page, approvedReview.productHandle);

    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 10_000,
    });

    // The sr-only text is visually hidden but present in the DOM
    await expect(page.getByText("5 out of 5 stars").first()).toBeAttached();

    // Star icons should be visible (yellow stars for rating)
    const stars = page.locator("div.py-12 svg.text-yellow-400").first();
    await expect(stars).toBeVisible();
  });

  test("shows review date", async ({ guestPage: page, approvedReview }) => {
    await gotoProductWithReviews(page, approvedReview.productHandle);

    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 10_000,
    });

    // Should have a <time> element inside a review item
    const timeEl = page.locator("div.py-12 time");
    await expect(timeEl.first()).toBeVisible();
  });

  test("shows review count in summary", async ({
    guestPage: page,
    approvedReview,
  }) => {
    await gotoProductWithReviews(page, approvedReview.productHandle);

    // "Based on X review(s)"
    await expect(page.locator(sel.REVIEW_COUNT_TEXT)).toBeVisible({
      timeout: 15_000,
    });

    const text =
      (await page.locator(sel.REVIEW_COUNT_TEXT).textContent()) ?? "";
    expect(text).toMatch(/Based on \d+ reviews?/);
  });

  test("displays admin response when present", async ({
    guestPage: page,
    reviewWithResponse,
  }) => {
    await gotoProductWithReviews(page, reviewWithResponse.productHandle);

    // Wait for reviews to load
    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });

    // Should show the "Store response" label
    await expect(
      page.locator(sel.REVIEW_STORE_RESPONSE_LABEL).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Should show the response content
    await expect(
      page.getByText(reviewWithResponse.responseContent).first(),
    ).toBeVisible();

    // Response card should have a date
    const responseCard = page.locator(sel.REVIEW_STORE_RESPONSE).first();
    await expect(responseCard.locator("time")).toBeVisible();
  });

  test("admin response has distinct styling", async ({
    guestPage: page,
    reviewWithResponse,
  }) => {
    await gotoProductWithReviews(page, reviewWithResponse.productHandle);

    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });

    // Response card should have bg-gray-50 background
    const responseCard = page.locator(sel.REVIEW_STORE_RESPONSE).first();
    await expect(responseCard).toBeVisible({ timeout: 10_000 });

    // Verify the response is inside a rounded-lg container with gray background
    await expect(responseCard).toHaveClass(/bg-gray-50/);
    await expect(responseCard).toHaveClass(/rounded-lg/);
  });

  test("reviews without response do not show response section", async ({
    guestPage: page,
    approvedReview,
  }) => {
    await gotoProductWithReviews(page, approvedReview.productHandle);

    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });

    // Find the review item that matches our fixture review (without response)
    const reviewContent = page
      .getByText("E2E test review", { exact: false })
      .first();
    await expect(reviewContent).toBeVisible({ timeout: 10_000 });

    // The review item containing this text should NOT have a store response
    const reviewItem = reviewContent.locator(
      "xpath=ancestor::div[contains(@class, 'py-12')]",
    );
    const responseInItem = reviewItem.locator('p:has-text("Store response")');
    await expect(responseInItem).toHaveCount(0);
  });
});
