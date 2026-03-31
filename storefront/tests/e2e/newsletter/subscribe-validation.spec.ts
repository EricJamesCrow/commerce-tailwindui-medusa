import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  gotoHomepageNewsletter,
  newsletterFooter,
  newsletterSubscriberExists,
  uniqueTestEmail,
  waitForNewsletterRequestSlot,
} from "./helpers";

test.setTimeout(180_000);

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

  test("ignores submissions that fill the honeypot field", async ({
    page,
  }, testInfo) => {
    const email = uniqueTestEmail("honeypot", testInfo.project.name);

    await gotoHomepageNewsletter(page);

    const { emailInput, signUpButton, successMessage } = newsletterFooter(page);

    await emailInput.fill(email);
    await page.locator('input[name="company"]').evaluate((element) => {
      (element as HTMLInputElement).value = "Acme Bot";
    });

    await waitForNewsletterRequestSlot();
    await signUpButton.click();

    await expect(successMessage).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => newsletterSubscriberExists(email)).toBe(false);
  });
});
