import { test, expect } from "../fixtures/auth.fixture";
import {
  createEmailPreferencesToken,
  getSubscriberPreferences,
  subscribeEmailViaApi,
  uniqueTestEmail,
} from "./helpers";

test.describe("email preferences", () => {
  test("authenticated customers can manage preferences from the account page", async ({
    authedPage,
    testCredentials,
  }) => {
    await authedPage.goto("/account");
    await authedPage.waitForLoadState("networkidle");

    await expect(
      authedPage.getByRole("heading", { name: "Email Preferences" }),
    ).toBeVisible();

    const newsletterCheckbox = authedPage.getByRole("checkbox", {
      name: "Promotions and newsletter",
    });
    const orderUpdatesCheckbox = authedPage.getByRole("checkbox", {
      name: "Order updates",
    });

    await expect(newsletterCheckbox).not.toBeChecked();
    await expect(orderUpdatesCheckbox).toBeChecked();

    await newsletterCheckbox.check();
    await orderUpdatesCheckbox.uncheck();
    await authedPage.getByRole("button", { name: "Save preferences" }).click();

    await expect
      .poll(() => getSubscriberPreferences(testCredentials.email))
      .toEqual({
        status: "active",
        orderUpdatesEnabled: false,
      });
  });

  test("email recipients can manage preferences from the email footer link", async ({
    guestPage,
  }) => {
    const email = uniqueTestEmail("email-preferences");
    await subscribeEmailViaApi(email);

    const token = createEmailPreferencesToken(email);

    await guestPage.goto(
      `/email-preferences?token=${encodeURIComponent(token)}`,
    );
    await guestPage.waitForLoadState("networkidle");

    await expect(
      guestPage.getByRole("heading", { name: "Manage what we send you" }),
    ).toBeVisible();

    const newsletterCheckbox = guestPage.getByRole("checkbox", {
      name: "Promotions and newsletter",
    });
    const orderUpdatesCheckbox = guestPage.getByRole("checkbox", {
      name: "Order updates",
    });

    await expect(newsletterCheckbox).toBeChecked();
    await expect(orderUpdatesCheckbox).toBeChecked();

    await newsletterCheckbox.uncheck();
    await orderUpdatesCheckbox.uncheck();
    await guestPage.getByRole("button", { name: "Save preferences" }).click();

    await expect
      .poll(() => getSubscriberPreferences(email))
      .toEqual({
        status: "unsubscribed",
        orderUpdatesEnabled: false,
      });
  });
});
