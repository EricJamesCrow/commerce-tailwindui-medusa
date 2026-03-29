import { sanitizeEnvValue } from "./env";

function firstDefinedValue(
  ...values: Array<string | undefined>
): string | null {
  for (const value of values) {
    const sanitized = sanitizeEnvValue(value);
    if (sanitized) {
      return sanitized;
    }
  }

  return null;
}

export function resolveStorefrontSentryEnvironment(): string {
  return (
    firstDefinedValue(
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      process.env.NEXT_PUBLIC_VERCEL_ENV,
      process.env.VERCEL_ENV,
      process.env.NODE_ENV,
    ) ?? "development"
  );
}

export function getStorefrontSentryBuildConfig(): {
  authToken?: string;
  org?: string;
  project?: string;
} {
  return {
    authToken: sanitizeEnvValue(process.env.SENTRY_AUTH_TOKEN),
    org: sanitizeEnvValue(process.env.SENTRY_ORG),
    project: sanitizeEnvValue(process.env.SENTRY_PROJECT),
  };
}
