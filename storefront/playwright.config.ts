import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local so NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is available to fixtures
const envPath = resolve(__dirname, ".env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1).replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // .env.local may not exist in CI — env vars should be set directly
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Turbopack dev server has intermittent module factory errors under concurrent load
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  webServer: {
    command: "cd .. && bun run dev",
    env: {
      ...process.env,
      E2E_ORDER_FIXTURES: "1",
    },
    url: "http://localhost:3000",
    // E2E order-progress fixtures are enabled via webServer env vars.
    // Reusing an already-running dev server bypasses those env vars and
    // makes the mocked order tests hit the real API instead.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
