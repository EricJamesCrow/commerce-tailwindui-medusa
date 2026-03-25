import { test, expect } from "../fixtures/review.fixture";
import * as sel from "../helpers/selectors";
import { TEST_JPEG } from "../helpers/test-jpeg";
import path from "path";
import fs from "fs";

/** Write the shared test JPEG to a temp file for Playwright's file input */
function createTestImage(name: string): string {
  const dir = path.join(process.cwd(), "tests", "e2e", ".tmp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, TEST_JPEG);
  return filePath;
}

test.describe("Review Image Upload", () => {
  test.afterAll(() => {
    // Cleanup temp images
    const dir = path.join(process.cwd(), "tests", "e2e", ".tmp");
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("shows photo upload area in review form", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Photo label should be visible
    await expect(page.locator(sel.REVIEW_PHOTO_LABEL)).toBeVisible();

    // Add photo button (dashed border label) should be visible
    await expect(page.locator(sel.REVIEW_ADD_PHOTO_LABEL)).toBeVisible();
  });

  test("can select an image and see thumbnail preview", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Select a file
    const testImage = createTestImage("test1.jpg");
    const fileInput = page.locator(sel.REVIEW_FILE_INPUT);
    await fileInput.setInputFiles(testImage);

    // Should show a thumbnail
    await expect(page.locator(sel.REVIEW_IMAGE_THUMBNAIL).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("can select up to 3 images", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Add 3 images one by one
    const img1 = createTestImage("test-a.jpg");
    const img2 = createTestImage("test-b.jpg");
    const img3 = createTestImage("test-c.jpg");

    const fileInput = page.locator(sel.REVIEW_FILE_INPUT);
    await fileInput.setInputFiles(img1);
    await expect(page.locator(sel.REVIEW_IMAGE_THUMBNAIL)).toHaveCount(1, {
      timeout: 5_000,
    });

    await fileInput.setInputFiles(img2);
    await expect(page.locator(sel.REVIEW_IMAGE_THUMBNAIL)).toHaveCount(2, {
      timeout: 5_000,
    });

    await fileInput.setInputFiles(img3);
    await expect(page.locator(sel.REVIEW_IMAGE_THUMBNAIL)).toHaveCount(3, {
      timeout: 5_000,
    });

    // The "add photo" label should no longer be visible (max reached)
    await expect(page.locator(sel.REVIEW_ADD_PHOTO_LABEL)).not.toBeVisible();
  });

  test("can remove a selected image", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Add an image
    const testImage = createTestImage("test-remove.jpg");
    await page.locator(sel.REVIEW_FILE_INPUT).setInputFiles(testImage);

    await expect(page.locator(sel.REVIEW_IMAGE_THUMBNAIL).first()).toBeVisible({
      timeout: 5_000,
    });

    // Click the remove button (small X on the thumbnail)
    // The remove button is in a div.relative next to the img
    const removeBtn = page.locator("form div.relative button").first();
    await removeBtn.click();

    // Thumbnail should be gone
    await expect(page.locator(sel.REVIEW_IMAGE_THUMBNAIL)).toHaveCount(0, {
      timeout: 5_000,
    });

    // Add photo label should reappear
    await expect(page.locator(sel.REVIEW_ADD_PHOTO_LABEL)).toBeVisible();
  });

  test("file input only accepts JPEG, PNG, and WebP", async ({
    authedPage: page,
    testProductHandle,
  }) => {
    await page.goto(`/product/${testProductHandle}`);
    await page.waitForLoadState("networkidle");

    await page.locator(sel.WRITE_REVIEW_BUTTON).click();
    await expect(page.locator(sel.REVIEW_DIALOG_TITLE)).toBeVisible({
      timeout: 5_000,
    });

    // Check the accept attribute
    const fileInput = page.locator(sel.REVIEW_FILE_INPUT);
    const accept = await fileInput.getAttribute("accept");
    expect(accept).toContain("image/jpeg");
    expect(accept).toContain("image/png");
    expect(accept).toContain("image/webp");
  });
});
