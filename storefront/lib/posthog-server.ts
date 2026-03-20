import "server-only"
import { PostHog } from "posthog-node"

let client: PostHog | null = null

export function getPostHogServer(): PostHog | null {
  const apiKey = process.env.POSTHOG_API_KEY
  if (!apiKey) return null

  if (!client) {
    client = new PostHog(apiKey, {
      host: "https://us.i.posthog.com",
      personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
      featureFlagsPollingInterval: 30000,
      flushAt: 1,
      flushInterval: 0,
    })

    process.on("beforeExit", () => {
      client?.shutdown()
    })
  }

  return client
}
