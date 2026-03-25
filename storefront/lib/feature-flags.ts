import "server-only";
import { getPostHogServer } from "./posthog-server";

export async function getFeatureFlag(
  flag: string,
  distinctId: string,
): Promise<boolean | string> {
  const posthog = getPostHogServer();
  if (!posthog) return false;

  try {
    const value = await posthog.getFeatureFlag(flag, distinctId);
    return value ?? false;
  } catch {
    return false;
  }
}

export async function getFeatureFlags(
  distinctId: string,
): Promise<Record<string, boolean | string>> {
  const posthog = getPostHogServer();
  if (!posthog) return {};

  try {
    const flags = await posthog.getAllFlags(distinctId);
    return (flags ?? {}) as Record<string, boolean | string>;
  } catch {
    return {};
  }
}
