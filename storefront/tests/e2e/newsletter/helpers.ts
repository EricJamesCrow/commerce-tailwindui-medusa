import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { BACKEND_URL, PUBLISHABLE_KEY } from "../fixtures/api.fixture";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost/medusa_db";
const PSQL =
  process.env.PSQL_PATH || "/opt/homebrew/opt/postgresql@17/bin/psql";
const NEWSLETTER_RATE_LIMIT_DIR = resolve(
  process.cwd(),
  ".playwright-newsletter-rate-limit",
);
const NEWSLETTER_RATE_LIMIT_LOCK_DIR = resolve(
  NEWSLETTER_RATE_LIMIT_DIR,
  "lock",
);
const NEWSLETTER_RATE_LIMIT_STATE_PATH = resolve(
  NEWSLETTER_RATE_LIMIT_DIR,
  "state.json",
);
const NEWSLETTER_REQUEST_INTERVAL_MS = 13_000;
const LOCK_RETRY_MS = 100;
const LOCK_STALE_MS = 30_000;

function sanitizeEmailPart(value?: string): string {
  if (!value) return "";
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function readNewsletterRateLimitState(): { lastRequestAt: number } {
  try {
    const raw = readFileSync(NEWSLETTER_RATE_LIMIT_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as { lastRequestAt?: unknown };

    return {
      lastRequestAt:
        typeof parsed.lastRequestAt === "number" ? parsed.lastRequestAt : 0,
    };
  } catch {
    return { lastRequestAt: 0 };
  }
}

function writeNewsletterRateLimitState(lastRequestAt: number): void {
  mkdirSync(NEWSLETTER_RATE_LIMIT_DIR, { recursive: true });
  writeFileSync(
    NEWSLETTER_RATE_LIMIT_STATE_PATH,
    JSON.stringify({ lastRequestAt }),
    "utf8",
  );
}

async function acquireNewsletterRateLimitLock(): Promise<() => void> {
  mkdirSync(NEWSLETTER_RATE_LIMIT_DIR, { recursive: true });

  while (true) {
    try {
      mkdirSync(NEWSLETTER_RATE_LIMIT_LOCK_DIR);
      return () => {
        rmSync(NEWSLETTER_RATE_LIMIT_LOCK_DIR, {
          recursive: true,
          force: true,
        });
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== "EEXIST") {
        throw error;
      }

      try {
        const ageMs =
          Date.now() - statSync(NEWSLETTER_RATE_LIMIT_LOCK_DIR).mtimeMs;

        if (ageMs > LOCK_STALE_MS) {
          rmSync(NEWSLETTER_RATE_LIMIT_LOCK_DIR, {
            recursive: true,
            force: true,
          });
          continue;
        }
      } catch {
        continue;
      }

      await sleep(LOCK_RETRY_MS);
    }
  }
}

export function uniqueTestEmail(prefix: string, suffix?: string): string {
  const safePrefix = sanitizeEmailPart(prefix) || "newsletter";
  const safeSuffix = sanitizeEmailPart(suffix);
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${safePrefix}${safeSuffix ? `-${safeSuffix}` : ""}-${nonce}@example.com`;
}

function runSql(sql: string): string {
  return execFileSync(PSQL, [DATABASE_URL, "-t", "-A", "-c", sql], {
    encoding: "utf8",
    timeout: 10_000,
  }).trim();
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

export async function waitForUnsubscribeNonce(
  email: string,
  timeoutMs = 15_000,
): Promise<string> {
  const normalizedEmail = escapeSqlString(email.toLowerCase());
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const nonce = runSql(
      `SELECT unsubscribe_nonce
       FROM newsletter_subscriber
       WHERE email = '${normalizedEmail}' AND deleted_at IS NULL
       LIMIT 1`,
    );

    if (nonce) {
      return nonce;
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for unsubscribe nonce for ${email}`);
}

export async function waitForNewsletterRequestSlot(): Promise<void> {
  const release = await acquireNewsletterRateLimitLock();

  try {
    const { lastRequestAt } = readNewsletterRateLimitState();
    const waitMs = Math.max(
      0,
      lastRequestAt + NEWSLETTER_REQUEST_INTERVAL_MS - Date.now(),
    );

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    writeNewsletterRateLimitState(Date.now());
  } finally {
    release();
  }
}

export async function subscribeEmailViaApi(email: string): Promise<void> {
  if (!PUBLISHABLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is required to seed newsletter subscriptions in E2E tests",
    );
  }

  await waitForNewsletterRequestSlot();

  const response = await fetch(`${BACKEND_URL}/store/newsletter/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      email: email.toLowerCase(),
      source: "import",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Newsletter seed subscribe failed (${response.status}): ${body}`,
    );
  }
}

export function newsletterFooter(page: Page) {
  const footer = page.getByRole("contentinfo", { name: "Footer" });

  return {
    footer,
    heading: footer.getByRole("heading", {
      name: "Sign up for our newsletter",
    }),
    emailInput: footer.getByRole("textbox", { name: "Email address" }),
    signUpButton: footer.getByRole("button", { name: "Sign up" }),
    successMessage: footer.getByText("Thanks! Check your inbox."),
  };
}

export async function gotoHomepageNewsletter(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const { heading } = newsletterFooter(page);
  await heading.scrollIntoViewIfNeeded();
}
