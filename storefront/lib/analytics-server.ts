import "server-only"
import type { AnalyticsEvents } from "./analytics"
import { getPostHogServer } from "./posthog-server"
import { getPostHogAnonId } from "./posthog-cookies"
import { getAuthToken } from "lib/medusa/cookies"
import { retrieveCustomer } from "lib/medusa/customer"

async function resolveDistinctId(): Promise<string | undefined> {
  const token = await getAuthToken()
  if (token) {
    const customer = await retrieveCustomer()
    return customer?.id
  }

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

export async function trackGoal<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
  experiment: { flagKey: string; variant: string },
): Promise<void> {
  // Cast: the spread adds a `$feature/<key>` property that isn't part of
  // AnalyticsEvents[E]. PostHog expects it but our strict type map can't
  // model dynamic keys. The cast is intentional — don't remove it.
  await trackServer(event, {
    ...properties,
    [`$feature/${experiment.flagKey}`]: experiment.variant,
  } as AnalyticsEvents[E])
}
