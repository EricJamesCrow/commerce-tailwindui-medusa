import { expect, type Page } from "@playwright/test";

export async function loginThroughAccountPage(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/account/login");

  const loginForm = page.locator("main form").first();
  await expect(loginForm).toBeVisible();
  await loginForm.locator('input[name="email"]').fill(email);
  await loginForm.locator('input[name="password"]').fill(password);
  await loginForm.locator('button[type="submit"]').click();

  await page.waitForURL("**/account", { timeout: 15_000 });
}
