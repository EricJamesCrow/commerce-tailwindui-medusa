import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoHomepageNewsletter, newsletterFooter } from "./helpers";

async function expectHtml5ValidationMessage(page: Page): Promise<void> {
  const { emailInput, successMessage } = newsletterFooter(page);

  await expect
    .poll(async () => {
      return emailInput.evaluate((element) => {
        const input = element as HTMLInputElement;
        return !input.checkValidity() && input.validationMessage.length > 0;
      });
    })
    .toBe(true);

  await expect(successMessage).toHaveCount(0);
  await expect(emailInput).toBeVisible();
}

test.describe("Newsletter Subscribe Validation", () => {
  test("blocks submission when the email is empty", async ({ page }) => {
    await gotoHomepageNewsletter(page);

    const { signUpButton } = newsletterFooter(page);

    await signUpButton.click();
    await expectHtml5ValidationMessage(page);
  });

  test("blocks submission when the email format is invalid", async ({
    page,
  }) => {
    await gotoHomepageNewsletter(page);

    const { emailInput, signUpButton } = newsletterFooter(page);

    await emailInput.fill("not-an-email");
    await signUpButton.click();
    await expectHtml5ValidationMessage(page);
  });
});
