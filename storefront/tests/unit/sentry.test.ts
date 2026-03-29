import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getStorefrontSentryBuildConfig,
  resolveStorefrontSentryEnvironment,
} from "../../lib/sentry";

function resetEnv() {
  const env = process.env as Record<string, string | undefined>;
  delete env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
  delete env.VERCEL_ENV;
  delete env.NODE_ENV;
  delete env.SENTRY_AUTH_TOKEN;
  delete env.SENTRY_ORG;
  delete env.SENTRY_PROJECT;
}

afterEach(() => {
  resetEnv();
  vi.unstubAllEnvs();
});

describe("resolveStorefrontSentryEnvironment", () => {
  it("prefers NEXT_PUBLIC_SENTRY_ENVIRONMENT when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "preview");
    vi.stubEnv("VERCEL_ENV", "production");

    expect(resolveStorefrontSentryEnvironment()).toBe("preview");
  });

  it("falls back to NEXT_PUBLIC_VERCEL_ENV and then NODE_ENV", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
    expect(resolveStorefrontSentryEnvironment()).toBe("preview");

    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveStorefrontSentryEnvironment()).toBe("production");
  });

  it("defaults to development when no environment variables are set", () => {
    resetEnv();

    expect(resolveStorefrontSentryEnvironment()).toBe("development");
  });
});

describe("getStorefrontSentryBuildConfig", () => {
  it("sanitizes whitespace and trailing newlines from build-time env vars", () => {
    vi.stubEnv("SENTRY_AUTH_TOKEN", " token-with-newline \n");
    vi.stubEnv("SENTRY_ORG", "crow-commerce\r\n");
    vi.stubEnv("SENTRY_PROJECT", "crowcommerce-storefront \n");

    expect(getStorefrontSentryBuildConfig()).toEqual({
      authToken: "token-with-newline",
      org: "crow-commerce",
      project: "crowcommerce-storefront",
    });
  });
});
