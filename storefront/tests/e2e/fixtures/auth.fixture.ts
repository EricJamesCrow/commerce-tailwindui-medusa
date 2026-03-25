import { test as base, type Page } from "@playwright/test";
import { MedusaApiClient } from "./api.fixture";
import { loginThroughAccountPage } from "../helpers/account-login";

type TestCredentials = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

type AuthFixtures = {
  /** API client authenticated as the test customer */
  api: MedusaApiClient;
  /** Credentials for the test customer (for UI-based login) */
  testCredentials: TestCredentials;
  /** A page already logged in as the test customer */
  authedPage: Page;
  /** A fresh page with no auth (guest) */
  guestPage: Page;
};

// Unique test customer credentials (per worker to avoid collisions)
function testCustomer(workerId: number): TestCredentials {
  return {
    email: `e2e-test-${workerId}-${Date.now()}@test.local`,
    password: "Test1234!",
    first_name: "E2E",
    last_name: `Tester${workerId}`,
  };
}

export const test = base.extend<AuthFixtures>({
  testCredentials: [
    async ({}, use, testInfo) => {
      await use(testCustomer(testInfo.parallelIndex));
    },
    { scope: "test" },
  ],

  api: async ({ testCredentials }, use) => {
    const api = new MedusaApiClient();
    await api.registerCustomer(testCredentials);
    await use(api);
  },

  authedPage: async ({ browser, api, testCredentials }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login through the UI — ensures all cookies are set by Next.js server actions
    await loginThroughAccountPage(
      page,
      testCredentials.email,
      testCredentials.password,
    );

    // Visit home page to stabilize session before handing off to tests
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await use(page);
    await context.close();
  },

  guestPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
