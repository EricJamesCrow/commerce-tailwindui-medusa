export const STOREFRONT_ATTRIBUTION_COOKIE = "_cc_storefront_attribution";
export const STOREFRONT_ATTRIBUTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const ATTRIBUTION_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
] as const;

export type AttributionQueryKey = (typeof ATTRIBUTION_QUERY_KEYS)[number];

export type AttributionValues = Partial<Record<AttributionQueryKey, string>>;

export type PersistedAttribution = AttributionValues & {
  landingPath: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

type StoredAttributionPayload = {
  version: 1;
  values: AttributionValues;
  landingPath: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

type SearchParamsLike = Pick<URLSearchParams, "get">;

export function extractAttributionValues(
  searchParams: SearchParamsLike,
): AttributionValues {
  const values: AttributionValues = {};

  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const value = searchParams.get(key)?.trim();
    if (value) {
      values[key] = value;
    }
  }

  return values;
}

export function hasAttributionValues(
  values: AttributionValues | null,
): boolean {
  if (!values) return false;
  return ATTRIBUTION_QUERY_KEYS.some((key) => Boolean(values[key]));
}

export function parsePersistedAttributionCookie(
  rawValue: string | null | undefined,
): PersistedAttribution | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(
      decodeURIComponent(rawValue),
    ) as Partial<StoredAttributionPayload>;

    if (parsed.version !== 1 || typeof parsed.values !== "object") {
      return null;
    }

    const values: AttributionValues = {};

    for (const key of ATTRIBUTION_QUERY_KEYS) {
      const value = parsed.values?.[key];
      if (typeof value === "string" && value.trim().length > 0) {
        values[key] = value.trim();
      }
    }

    if (!hasAttributionValues(values)) return null;

    return {
      ...values,
      landingPath:
        typeof parsed.landingPath === "string" && parsed.landingPath.length > 0
          ? parsed.landingPath
          : null,
      firstSeenAt:
        typeof parsed.firstSeenAt === "string" && parsed.firstSeenAt.length > 0
          ? parsed.firstSeenAt
          : null,
      lastSeenAt:
        typeof parsed.lastSeenAt === "string" && parsed.lastSeenAt.length > 0
          ? parsed.lastSeenAt
          : null,
    };
  } catch {
    return null;
  }
}

export function serializePersistedAttributionCookie(
  attribution: PersistedAttribution | null,
): string | null {
  if (!attribution || !hasAttributionValues(attribution)) return null;

  const values: AttributionValues = {};
  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const value = attribution[key];
    if (value) {
      values[key] = value;
    }
  }

  const payload: StoredAttributionPayload = {
    version: 1,
    values,
    landingPath: attribution.landingPath,
    firstSeenAt: attribution.firstSeenAt,
    lastSeenAt: attribution.lastSeenAt,
  };

  return encodeURIComponent(JSON.stringify(payload));
}

export function mergePersistedAttribution(
  existing: PersistedAttribution | null,
  incoming: AttributionValues,
  pathname: string,
  timestamp = new Date().toISOString(),
): PersistedAttribution | null {
  const mergedValues: AttributionValues = {};

  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const incomingValue = incoming[key];
    const existingValue = existing?.[key];
    if (incomingValue) {
      mergedValues[key] = incomingValue;
    } else if (existingValue) {
      mergedValues[key] = existingValue;
    }
  }

  if (!hasAttributionValues(mergedValues)) return null;

  return {
    ...mergedValues,
    landingPath: existing?.landingPath || pathname,
    firstSeenAt: existing?.firstSeenAt || timestamp,
    lastSeenAt: hasAttributionValues(incoming)
      ? timestamp
      : existing?.lastSeenAt || existing?.firstSeenAt || timestamp,
  };
}

export function getMissingAttributionValues(
  current: AttributionValues,
  persisted: PersistedAttribution | null,
): AttributionValues {
  if (!persisted) return {};

  const missing: AttributionValues = {};

  for (const key of ATTRIBUTION_QUERY_KEYS) {
    if (!current[key] && persisted[key]) {
      missing[key] = persisted[key];
    }
  }

  return missing;
}
