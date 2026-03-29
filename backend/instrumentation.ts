import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { registerOtel } from "@medusajs/medusa";

function sanitizeEnvValue(value: string | undefined): string | undefined {
  const sanitized = value?.replace(/[\r\n]+/g, "").trim();
  return sanitized ? sanitized : undefined;
}

Sentry.init({
  dsn: sanitizeEnvValue(process.env.SENTRY_DSN),
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"),
  profilesSampleRate: 0.1,
  integrations: [nodeProfilingIntegration()],
  environment:
    sanitizeEnvValue(process.env.SENTRY_ENVIRONMENT) ||
    sanitizeEnvValue(process.env.RAILWAY_ENVIRONMENT) ||
    sanitizeEnvValue(process.env.NODE_ENV) ||
    "development",
});

export function register() {
  registerOtel({
    serviceName: "crowcommerce-backend",
    instrument: {
      http: true,
      workflows: true,
      query: true,
      db: true,
    },
  });
}
