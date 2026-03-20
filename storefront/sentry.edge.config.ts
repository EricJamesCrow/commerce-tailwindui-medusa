import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: parseFloat(
    process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"
  ),
})
