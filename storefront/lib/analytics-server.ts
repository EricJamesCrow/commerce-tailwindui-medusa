import "server-only"
import type { AnalyticsEvents } from "./analytics"
import { getPostHogServer } from "./posthog-server"
import { getPostHogAnonId } from "./posthog-cookies"
import { getAuthToken } from "lib/medusa/cookies"

async function resolveDistinctId(): Promise<string | undefined> {
  const token = await getAuthToken()
  if (token) return undefined // Caller passes explicit customer ID for auth events

  return await getPostHogAnonId()
}

export async function trackServer<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
  distinctId?: string,
): Promise<void> {
  const posthog = getPostHogServer()
  if (!posthog) return

  const id = distinctId || (await resolveDistinctId())
  if (!id) return

  posthog.capture({
    distinctId: id,
    event,
    properties: properties as Record<string, unknown>,
  })
}
