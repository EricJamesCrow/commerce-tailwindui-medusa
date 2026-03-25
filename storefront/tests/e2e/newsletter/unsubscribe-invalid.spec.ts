import { test, expect } from "@playwright/test";
import { waitForNewsletterRequestSlot } from "./helpers";

test.setTimeout(180_000);

test.describe("Newsletter Unsubscribe Invalid Token", () => {
  test("shows an error after confirming with an invalid token", async ({
    page,
  }) => {
    await page.goto("/newsletter/unsubscribe?token=invalid-garbage");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Unsubscribe from newsletter" }),
    ).toBeVisible();

    await waitForNewsletterRequestSlot();
    await page.getByRole("button", { name: "Confirm unsubscribe" }).click();

    await expect(
      page.getByRole("heading", { name: "Something went wrong" }),
    ).toBeVisible({ timeout: 10_000 });
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
});
