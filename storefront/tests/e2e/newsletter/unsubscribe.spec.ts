import { test, expect } from "@playwright/test";
import {
  subscribeEmailViaApi,
  uniqueTestEmail,
  waitForNewsletterRequestSlot,
  waitForUnsubscribeNonce,
} from "./helpers";

test.setTimeout(180_000);

test.describe("Newsletter Unsubscribe", () => {
  test("shows the confirmation page and unsubscribes successfully", async ({
    page,
  }, testInfo) => {
    const email = uniqueTestEmail("unsub-test", testInfo.project.name);

    await subscribeEmailViaApi(email);
    const token = await waitForUnsubscribeNonce(email);

    await page.goto(
      `/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
    );
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Unsubscribe from newsletter" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/newsletter\/unsubscribe$/);

    const confirmButton = page.getByRole("button", {
      name: "Confirm unsubscribe",
    });

    await expect(confirmButton).toBeVisible();
    await waitForNewsletterRequestSlot();
    await confirmButton.click();

    await expect(
      page.getByRole("heading", { name: "You've been unsubscribed" }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
