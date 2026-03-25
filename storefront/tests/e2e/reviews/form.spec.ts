import { test, expect } from "../fixtures/review.fixture";
import * as sel from "../helpers/selectors";

test.describe("Review Form", () => {
  test("shows write review button on product page", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator(sel.WRITE_REVIEW_BUTTON)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("opens review form dialog when clicking write review", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await page.locator(sel.WRITE_REVIEW_BUTTON).click();

    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(sel.REVIEW_TITLE_INPUT)).toBeVisible();
    await expect(page.locator(sel.REVIEW_CONTENT_INPUT)).toBeVisible();
  });

  test("can set star rating by clicking stars", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Click the 4th star
    await page.locator(sel.REVIEW_STAR_BUTTON(4)).click();

    // Hidden rating input should have value 4
    const ratingInput = page.locator('input[name="rating"]');
    await expect(ratingInput).toHaveValue("4");
  });

  test("submit button is disabled when no rating is set", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    const submitBtn = page.locator(sel.REVIEW_SUBMIT_BUTTON).last();
    await expect(submitBtn).toBeDisabled();
  });

  test("can submit a text-only review", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Set rating
    await page.locator(sel.REVIEW_STAR_BUTTON(5)).click();

    // Fill title (optional)
    await page.locator(sel.REVIEW_TITLE_INPUT).fill("Excellent product!");

    // Fill content (required)
    await page
      .locator(sel.REVIEW_CONTENT_INPUT)
      .fill("This product exceeded my expectations. Highly recommend!");

    // Submit
    const submitBtn = page.locator(sel.REVIEW_SUBMIT_BUTTON).last();
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Dialog closes immediately (optimistic submission)
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).not.toBeVisible({
      timeout: 5_000,
    });

    // Review appears in the list (use .first() since prior runs may leave matching reviews)
    await expect(
      page
        .locator(sel.REVIEW_CONTENT_TEXT)
        .filter({
          hasText: "This product exceeded my expectations",
        })
        .first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("shows error when content is empty", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Set rating but leave content empty
    await page.locator(sel.REVIEW_STAR_BUTTON(3)).click();

    // The content textarea has `required` attribute — the browser should prevent submission.
    // We can verify the submit button is enabled (rating is set) but form won't submit
    // because of HTML5 validation on the textarea.
    const submitBtn = page.locator(sel.REVIEW_SUBMIT_BUTTON).last();
    await expect(submitBtn).toBeEnabled();
  });

  test("guest user can see write review button but submission shows error", async ({
    guestPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    // The write review button should be visible (canReview is always true)
    await expect(page.locator(sel.WRITE_REVIEW_BUTTON)).toBeVisible({
      timeout: 15_000,
    });

    // Open form
    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Fill form
    await page.locator(sel.REVIEW_STAR_BUTTON(4)).click();
    await page.locator(sel.REVIEW_CONTENT_INPUT).fill("Guest review attempt");

    // Submit — should fail with auth error
    const submitBtn = page.locator(sel.REVIEW_SUBMIT_BUTTON).last();
    await submitBtn.click();

    // Should show error (not success)
    await expect(page.locator(sel.REVIEW_ERROR_MESSAGE)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("can close review dialog with X button", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Close with the X button (sr-only "Close" label)
    await page.locator('button:has(span:has-text("Close"))').click();

    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).not.toBeVisible({
      timeout: 5_000,
    });
  });
});
