import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"
import { registerOtel } from "@medusajs/medusa"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"),
  profilesSampleRate: 0.1,
  integrations: [nodeProfilingIntegration()],
  environment:
    process.env.SENTRY_ENVIRONMENT ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.NODE_ENV ||
    "development",
})

export function register() {
  registerOtel({
    serviceName: "crowcommerce-backend",
    instrument: {
      http: true,
      workflows: true,
      query: true,
      db: true,
    },
  })
}
