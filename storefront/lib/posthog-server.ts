import "server-only";
import { PostHog } from "posthog-node";
import { sanitizeEnvValue } from "./env";

let client: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  const apiKey = sanitizeEnvValue(process.env.POSTHOG_API_KEY);
  if (!apiKey) return null;

  if (!client) {
    client = new PostHog(apiKey, {
      host:
        sanitizeEnvValue(process.env.NEXT_PUBLIC_POSTHOG_HOST) ||
        "https://us.i.posthog.com",
      personalApiKey: sanitizeEnvValue(process.env.POSTHOG_PERSONAL_API_KEY),
      featureFlagsPollingInterval: 30000,
      flushAt: 1,
      flushInterval: 0,
    });

    process.on("beforeExit", () => {
      client?.shutdown();
    });
  }

  return client;
}
