import * as Sentry from "@sentry/nextjs";
import { browserProfilingIntegration } from "@sentry/nextjs";
import { sanitizeEnvValue } from "./lib/env";
import { resolveStorefrontSentryEnvironment } from "./lib/sentry";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: sanitizeEnvValue(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: resolveStorefrontSentryEnvironment(),
  tracesSampleRate: parseFloat(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0.2",
  ),
  profilesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    browserProfilingIntegration(),
  ],
});
