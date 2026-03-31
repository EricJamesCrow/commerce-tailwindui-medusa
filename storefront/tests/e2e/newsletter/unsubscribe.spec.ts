import { test, expect } from "@playwright/test";
import {
  getStoredUnsubscribeToken,
  subscribeEmailViaApi,
  uniqueTestEmail,
  waitForNewsletterRequestSlot,
} from "./helpers";

test.setTimeout(180_000);

test.describe("Newsletter Unsubscribe", () => {
  test("shows the confirmation page and unsubscribes successfully", async ({
    page,
  }, testInfo) => {
    const email = uniqueTestEmail("unsub-test", testInfo.project.name);

    await subscribeEmailViaApi(email);
    const token = getStoredUnsubscribeToken(email);

    await page.goto(
      `/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
    );
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url()).not.toContain("token=");

    await expect(
      page.getByRole("heading", { name: "Unsubscribe from newsletter" }),
    ).toBeVisible();

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

  test("rejects replaying a previously used unsubscribe link", async ({
    page,
  }, testInfo) => {
    const email = uniqueTestEmail("unsub-replay", testInfo.project.name);

    await subscribeEmailViaApi(email);
    const token = getStoredUnsubscribeToken(email);

    await page.goto(
      `/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
    );
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url()).not.toContain("token=");

    await waitForNewsletterRequestSlot();
    await page.getByRole("button", { name: "Confirm unsubscribe" }).click();

    await expect(
      page.getByRole("heading", { name: "You've been unsubscribed" }),
    ).toBeVisible({ timeout: 10_000 });

    await page.goto(
      `/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
    );
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url()).not.toContain("token=");

    await expect(
      page.getByRole("heading", { name: "Unsubscribe from newsletter" }),
    ).toBeVisible();

    await waitForNewsletterRequestSlot();
    await page.getByRole("button", { name: "Confirm unsubscribe" }).click();

    await expect(
      page.getByRole("heading", { name: "Something went wrong" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(
        "This unsubscribe link is invalid or has expired. Please use the link in your most recent email.",
      ),
    ).toBeVisible();
  });

  test("keeps each confirmation bound to the link that rendered it", async ({
    page,
  }, testInfo) => {
    const emailOne = uniqueTestEmail("unsub-tab-one", testInfo.project.name);
    const emailTwo = uniqueTestEmail("unsub-tab-two", testInfo.project.name);

    await subscribeEmailViaApi(emailOne);
    await subscribeEmailViaApi(emailTwo);

    const tokenOne = getStoredUnsubscribeToken(emailOne);
    const tokenTwo = getStoredUnsubscribeToken(emailTwo);
    const secondPage = await page.context().newPage();

    await page.goto(
      `/newsletter/unsubscribe?token=${encodeURIComponent(tokenOne)}`,
    );
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url()).not.toContain("token=");

    await secondPage.goto(
      `/newsletter/unsubscribe?token=${encodeURIComponent(tokenTwo)}`,
    );
    await secondPage.waitForLoadState("networkidle");
    await expect.poll(() => secondPage.url()).not.toContain("token=");

    await waitForNewsletterRequestSlot();
    await page.getByRole("button", { name: "Confirm unsubscribe" }).click();
    await expect(
      page.getByRole("heading", { name: "You've been unsubscribed" }),
    ).toBeVisible({ timeout: 10_000 });

    await waitForNewsletterRequestSlot();
    await secondPage
      .getByRole("button", { name: "Confirm unsubscribe" })
      .click();
    await expect(
      secondPage.getByRole("heading", { name: "You've been unsubscribed" }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
