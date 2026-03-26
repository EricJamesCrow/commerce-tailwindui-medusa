import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function getWebServerEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

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
  outputDir: "test-results",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  timeout: 60_000,
  use: {
    baseURL,
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
    // This default command assumes a POSIX/bash-like shell, which matches CI and local macOS/Linux use.
    command:
      process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ??
      'trap "kill 0" EXIT; cd ..; (cd backend && bun run dev) & (cd storefront && bun run dev) & wait',
    env: getWebServerEnv(),
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
