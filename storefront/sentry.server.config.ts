import * as Sentry from "@sentry/nextjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { sanitizeEnvValue } from "./lib/env";
import { resolveStorefrontSentryEnvironment } from "./lib/sentry";

Sentry.init({
  dsn: sanitizeEnvValue(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"),
  profilesSampleRate: 0.1,
  integrations: [nodeProfilingIntegration()],
  environment: resolveStorefrontSentryEnvironment(),
});
