import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { uniqueTestEmail } from "../newsletter/helpers";

const BACKEND_ENV_PATH = resolve(__dirname, "../../../../backend/.env");

function parseEnvValue(content: string, key: string): string | null {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const currentKey = line.slice(0, separator).trim();
    if (currentKey !== key) continue;

    return line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }

  return null;
}

function hasBackendEmailConfig(): boolean {
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    return true;
  }

  try {
    const envFile = readFileSync(BACKEND_ENV_PATH, "utf8");
    return Boolean(
      parseEnvValue(envFile, "RESEND_API_KEY") &&
        parseEnvValue(envFile, "RESEND_FROM_EMAIL"),
    );
  } catch {
    return false;
  }
}

function contactForm(page: Page) {
  const form = page.locator("main form").filter({
    has: page.getByLabel("First name"),
  });

  return {
    form,
    firstNameInput: form.getByLabel("First name"),
    lastNameInput: form.getByLabel("Last name"),
    emailInput: form.getByLabel("Email"),
    subjectInput: form.getByLabel("Subject"),
    messageInput: form.getByLabel("Message"),
    submitButton: form.getByRole("button", { name: "Send message" }),
    successMessage: page.getByText("Message sent. Thanks for reaching out."),
  };
}

test.describe("Contact form", () => {
  test("blocks submission when the email format is invalid", async ({
    page,
  }) => {
    await page.goto("/contact");
    await page.waitForLoadState("networkidle");

    const {
      emailInput,
      firstNameInput,
      lastNameInput,
      subjectInput,
      messageInput,
      submitButton,
      successMessage,
    } = contactForm(page);

    await firstNameInput.fill("Casey");
    await lastNameInput.fill("Rivera");
    await emailInput.fill("not-an-email");
    await subjectInput.fill("Wholesale question");
    await messageInput.fill(
      "I want to understand your wholesale minimums for a spring launch.",
    );

    await submitButton.click();

    await expect
      .poll(async () => {
        return emailInput.evaluate((element) => {
          const input = element as HTMLInputElement;
          return !input.checkValidity() && input.validationMessage.length > 0;
        });
      })
      .toBe(true);

    await expect(successMessage).toHaveCount(0);
    await expect(submitButton).toBeVisible();
  });

  test("submits a valid contact request and shows success only after completion", async ({
    page,
  }, testInfo) => {
    test.skip(
      !hasBackendEmailConfig(),
      "RESEND_API_KEY and RESEND_FROM_EMAIL are required for the real contact-form submission path",
    );

    await page.goto("/contact");
    await page.waitForLoadState("networkidle");

    const {
      firstNameInput,
      lastNameInput,
      emailInput,
      subjectInput,
      messageInput,
      submitButton,
      successMessage,
      form,
    } = contactForm(page);

    await firstNameInput.fill("Casey");
    await lastNameInput.fill("Rivera");
    await emailInput.fill(uniqueTestEmail("contact", testInfo.project.name));
    await subjectInput.fill(`Wholesale question ${Date.now()}`);
    await messageInput.fill(
      "Hi team, I want to understand your wholesale minimums and lead times for a spring launch.",
    );

    await submitButton.click();

    await expect(successMessage).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Message sent", { exact: true })).toBeVisible();
    await expect(
      page.getByText("We typically respond within one business day."),
    ).toBeVisible();
    await expect(form).toHaveCount(0);
  });
});
