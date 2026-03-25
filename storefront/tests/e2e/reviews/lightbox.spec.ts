import {
  test,
  expect,
  approveReview,
  revalidateReviewsCache,
  cleanupReview,
  createReview,
  createReviewImages,
} from "../fixtures/review.fixture";
import * as sel from "../helpers/selectors";

/**
 * Create a review with images, inserting images directly via SQL to bypass
 * API hostname validation (which rejects placeholder URLs when S3_FILE_URL is set).
 */
async function createReviewWithImages(
  api: { getAuthToken(): string },
  productId: string,
): Promise<string> {
  const reviewId = await createReview(api.getAuthToken(), {
    product_id: productId,
    title: "Review with photos",
    content: "Check out these product photos from my purchase!",
    rating: 5,
    first_name: "E2E",
    last_name: "PhotoReviewer",
  });

  createReviewImages(reviewId, [
    { url: "https://placehold.co/400x300/orange/white?text=Review+Image+1", sort_order: 0 },
    { url: "https://placehold.co/400x300/blue/white?text=Review+Image+2", sort_order: 1 },
    { url: "https://placehold.co/400x300/green/white?text=Review+Image+3", sort_order: 2 },
  ]);

  approveReview(reviewId);
  await revalidateReviewsCache();
  return reviewId;
}

/**
 * Navigate to product page and ensure reviews WITH images are loaded.
 * Retries with reloads to handle Next.js cache propagation timing.
 */
async function gotoProductWithImageReviews(
  page: import("@playwright/test").Page,
  handle: string,
) {
  await page.goto(`/product/${handle}`);
  await page.waitForLoadState("networkidle");

  const heading = page.locator(sel.REVIEW_SECTION_HEADING);
  const thumbnail = page.locator("div.mt-3 button").first();

  // Retry until a review with image thumbnails is visible
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await heading.waitFor({ state: "visible", timeout: 5_000 });
      await thumbnail.waitFor({ state: "visible", timeout: 3_000 });
      return;
    } catch {
      await page.reload({ waitUntil: "networkidle" });
    }
  }
  await expect(heading).toBeVisible({ timeout: 15_000 });
  await expect(thumbnail).toBeVisible({ timeout: 10_000 });
}

/**
 * Helper to wait for the lightbox dialog to be open.
 * Headless UI Dialog wrapper has zero dimensions, so we check
 * for the data attribute and then verify the image is present.
 */
async function expectLightboxOpen(page: import("@playwright/test").Page) {
  // The dialog element exists with data-headlessui-state="open"
  await expect(page.locator(sel.REVIEW_LIGHTBOX_DIALOG)).toBeAttached({
    timeout: 5_000,
  });
  // The lightbox image should be present in the DOM
  await expect(page.locator(sel.REVIEW_LIGHTBOX_IMAGE)).toBeAttached({
    timeout: 5_000,
  });
}

test.describe("Review Image Lightbox", () => {
  const createdReviewIds: string[] = [];

  test.afterEach(() => {
    for (const id of createdReviewIds) {
      cleanupReview(id);
    }
    createdReviewIds.length = 0;
  });

  test("shows image thumbnails for reviews with images", async ({
    guestPage: page,
    api,
    testProductId,
    testProductHandle,
  }) => {
    createdReviewIds.push(await createReviewWithImages(api, testProductId));
    await gotoProductWithImageReviews(page, testProductHandle);

    // Wait for review list
    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });

    // Should see image thumbnails
    await expect(
      page.locator(sel.REVIEW_LIST_THUMBNAIL).first(),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Should have 3 thumbnails for our review
    const thumbnails = page.locator("div.mt-3 button img");
    const count = await thumbnails.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("clicking thumbnail opens lightbox dialog", async ({
    guestPage: page,
    api,
    testProductId,
    testProductHandle,
  }) => {
    createdReviewIds.push(await createReviewWithImages(api, testProductId));
    await gotoProductWithImageReviews(page, testProductHandle);

    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });

    // Click the first thumbnail
    const thumbnail = page.locator("div.mt-3 button").first();
    await expect(thumbnail).toBeVisible({ timeout: 10_000 });
    await thumbnail.click();

    // Lightbox dialog should open
    await expectLightboxOpen(page);
  });

  test("lightbox shows navigation arrows for multiple images", async ({
    guestPage: page,
    api,
    testProductId,
    testProductHandle,
  }) => {
    createdReviewIds.push(await createReviewWithImages(api, testProductId));
    await gotoProductWithImageReviews(page, testProductHandle);

    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });

    // Click a thumbnail to open lightbox
    const thumbnail = page.locator("div.mt-3 button").first();
    await expect(thumbnail).toBeVisible({ timeout: 10_000 });
    await thumbnail.click();

    await expectLightboxOpen(page);

    // Should show prev/next navigation buttons
    const navButtons = page.locator(
      '[role="dialog"] button:has(svg.size-6)',
    );
    await expect(navButtons.first()).toBeAttached({ timeout: 5_000 });
    const count = await navButtons.count();
    expect(count).toBe(2);
  });

  test("can navigate between images in lightbox", async ({
    guestPage: page,
    api,
    testProductId,
    testProductHandle,
  }) => {
    createdReviewIds.push(await createReviewWithImages(api, testProductId));
    await gotoProductWithImageReviews(page, testProductHandle);

    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });

    // Click the first thumbnail
    const thumbnail = page.locator("div.mt-3 button").first();
    await expect(thumbnail).toBeVisible({ timeout: 10_000 });
    await thumbnail.click();

    await expectLightboxOpen(page);

    // Get initial image src
    const image = page.locator(sel.REVIEW_LIGHTBOX_IMAGE);
    const initialSrc = await image.getAttribute("src");

    // Click next button (last nav button in the dialog)
    const nextBtn = page
      .locator('[role="dialog"] button:has(svg.size-6)')
      .last();
    await nextBtn.click();

    // Image src should change
    expect(initialSrc).toBeTruthy();
    await expect(image).not.toHaveAttribute("src", initialSrc as string, {
      timeout: 5_000,
    });
  });

  test("can close lightbox with X button", async ({
    guestPage: page,
    api,
    testProductId,
    testProductHandle,
  }) => {
    createdReviewIds.push(await createReviewWithImages(api, testProductId));
    await gotoProductWithImageReviews(page, testProductHandle);

    await expect(page.locator(sel.REVIEW_LIST_ITEM).first()).toBeVisible({
      timeout: 15_000,
    });

    // Open lightbox
    const thumbnail = page.locator("div.mt-3 button").first();
    await expect(thumbnail).toBeVisible({ timeout: 10_000 });
    await thumbnail.click();

    await expectLightboxOpen(page);

    // Close with the X button (has svg.size-8)
    const closeBtn = page.locator('[role="dialog"] button:has(svg.size-8)');
    await closeBtn.click();

    // Dialog should close (element should be detached from DOM)
    await expect(
      page.locator(sel.REVIEW_LIGHTBOX_DIALOG),
    ).not.toBeAttached({ timeout: 5_000 });
  });
});
