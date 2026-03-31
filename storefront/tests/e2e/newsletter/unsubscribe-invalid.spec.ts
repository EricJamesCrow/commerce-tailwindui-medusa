import { test, expect } from "@playwright/test";
import {
  expireStoredUnsubscribeToken,
  getStoredUnsubscribeToken,
  subscribeEmailViaApi,
  uniqueTestEmail,
  waitForNewsletterRequestSlot,
} from "./helpers";

test.setTimeout(180_000);

test.describe("Newsletter Unsubscribe Invalid Token", () => {
  test("shows an error after confirming with an invalid token", async ({
    page,
  }) => {
    await page.goto("/newsletter/unsubscribe?token=invalid-garbage");
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
  });

  test("ignores forged status values while an unsubscribe token is active", async ({
    page,
  }, testInfo) => {
    const email = uniqueTestEmail("unsub-forged-status", testInfo.project.name);

    await subscribeEmailViaApi(email);
    const token = getStoredUnsubscribeToken(email);

    await page.goto(
      `/newsletter/unsubscribe?token=${encodeURIComponent(token)}&status=success`,
    );
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url()).not.toContain("token=");

    await expect(
      page.getByRole("heading", { name: "Unsubscribe from newsletter" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "You've been unsubscribed" }),
    ).not.toBeVisible();
  });

  test("shows an invalid link state when the token is missing", async ({
    page,
  }) => {
    await page.goto("/newsletter/unsubscribe");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Invalid Link" }),
    ).toBeVisible();
  });

  test("shows an expired-link error after confirming with an expired token", async ({
    page,
  }, testInfo) => {
    const email = uniqueTestEmail("unsub-expired", testInfo.project.name);

    await subscribeEmailViaApi(email);
    const token = getStoredUnsubscribeToken(email);
    expireStoredUnsubscribeToken(email);

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
});
