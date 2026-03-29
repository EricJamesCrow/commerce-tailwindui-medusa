import { test, expect } from "../fixtures/review.fixture";
import * as sel from "../helpers/selectors";

test.describe("Moderated Review Submission", () => {
  test("shows a moderation message instead of publishing immediately", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    // Open review form
    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Fill and submit
    await page.locator(sel.REVIEW_STAR_BUTTON(4)).click();
    await page.locator(sel.REVIEW_TITLE_INPUT).fill("Optimistic test review");
    await page
      .locator(sel.REVIEW_CONTENT_INPUT)
      .fill("This review should appear instantly without a page refresh.");

    const submitBtn = page.locator(sel.REVIEW_SUBMIT_BUTTON).last();
    await submitBtn.click();

    // Dialog should close immediately
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).not.toBeVisible({
      timeout: 5_000,
    });

    await expect(
      page.getByText(
        "Thanks for your review. It has been submitted for moderation and will appear once approved.",
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("summary count does not update before approval", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    // Read the current review count from the summary
    const countText = page.locator(sel.REVIEW_COUNT_TEXT);
    await expect(countText).toBeVisible({ timeout: 15_000 });
    const beforeText = await countText.textContent();
    const beforeCount = parseInt(beforeText?.match(/\d+/)?.[0] || "0", 10);

    // Open review form
    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Fill and submit
    await page.locator(sel.REVIEW_STAR_BUTTON(3)).click();
    await page
      .locator(sel.REVIEW_CONTENT_INPUT)
      .fill("Testing summary count update.");

    const submitBtn = page.locator(sel.REVIEW_SUBMIT_BUTTON).last();
    await submitBtn.click();

    // Dialog should close
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).not.toBeVisible({
      timeout: 5_000,
    });

    await expect(countText).toHaveText(
      new RegExp(`Based on ${beforeCount} review`),
      { timeout: 10_000 },
    );
  });

  test("pending review does not appear in the public list after dialog closes", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    // Open, fill, submit
    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    await page.locator(sel.REVIEW_STAR_BUTTON(5)).click();
    await page.locator(sel.REVIEW_TITLE_INPUT).fill("Persistent review");
    await page
      .locator(sel.REVIEW_CONTENT_INPUT)
      .fill("This review should persist after the dialog closes.");

    const submitBtn = page.locator(sel.REVIEW_SUBMIT_BUTTON).last();
    await submitBtn.click();

    // Dialog closes
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).not.toBeVisible({
      timeout: 5_000,
    });

    // Scroll to reviews section and verify the review is still hidden until approval
    await page.locator(sel.REVIEW_SECTION_HEADING).scrollIntoViewIfNeeded();

    await expect(
      page
        .locator(sel.REVIEW_CONTENT_TEXT)
        .filter({
          hasText: "This review should persist after the dialog closes",
        })
        .first(),
    ).toHaveCount(0);
  });
});
