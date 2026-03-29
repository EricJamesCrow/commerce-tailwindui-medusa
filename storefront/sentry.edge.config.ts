import * as Sentry from "@sentry/nextjs";
import { sanitizeEnvValue } from "./lib/env";
import { resolveStorefrontSentryEnvironment } from "./lib/sentry";

Sentry.init({
  dsn: sanitizeEnvValue(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: resolveStorefrontSentryEnvironment(),
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"),
});
