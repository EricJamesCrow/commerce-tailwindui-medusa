import { sanitizeEnvValue } from "lib/env";

export const STOREFRONT_CONSENT_COOKIE = "_cc_storefront_consent";
export const STOREFRONT_CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export type AnalyticsConsentStatus = "pending" | "granted" | "denied";

export type StorefrontConsentState = {
  analytics: AnalyticsConsentStatus;
  updatedAt: string | null;
};

type StoredConsentPayload = {
  version: 1;
  analytics: Exclude<AnalyticsConsentStatus, "pending">;
  updatedAt: string;
};

export const DEFAULT_STOREFRONT_CONSENT: StorefrontConsentState = {
  analytics: "pending",
  updatedAt: null,
};

export function isStorefrontConsentFoundationEnabled(): boolean {
  const value = sanitizeEnvValue(
    process.env.NEXT_PUBLIC_CONSENT_FOUNDATION_ENABLED,
  );

  return value !== "false";
}

export function createStorefrontConsentState(
  analytics: Exclude<AnalyticsConsentStatus, "pending">,
  updatedAt = new Date().toISOString(),
): StorefrontConsentState {
  return {
    analytics,
    updatedAt,
  };
}

export function hasStoredConsentDecision(
  consent: StorefrontConsentState,
): boolean {
  return consent.analytics !== "pending";
}

export function isAnalyticsConsentGranted(
  consent: StorefrontConsentState,
): boolean {
  return consent.analytics === "granted";
}

export function parseStorefrontConsentCookie(
  rawValue: string | null | undefined,
): StorefrontConsentState {
  if (!rawValue) return DEFAULT_STOREFRONT_CONSENT;

  try {
    const parsed = JSON.parse(
      decodeURIComponent(rawValue),
    ) as Partial<StoredConsentPayload>;

    if (
      parsed.version !== 1 ||
      (parsed.analytics !== "granted" && parsed.analytics !== "denied")
    ) {
      return DEFAULT_STOREFRONT_CONSENT;
    }

    return {
      analytics: parsed.analytics,
      updatedAt:
        typeof parsed.updatedAt === "string" && parsed.updatedAt.length > 0
          ? parsed.updatedAt
          : null,
    };
  } catch {
    return DEFAULT_STOREFRONT_CONSENT;
  }
}

export function serializeStorefrontConsentCookie(
  consent: StorefrontConsentState,
): string | null {
  if (!hasStoredConsentDecision(consent)) return null;
  const analytics = consent.analytics === "granted" ? "granted" : "denied";

  const payload: StoredConsentPayload = {
    version: 1,
    analytics,
    updatedAt: consent.updatedAt || new Date().toISOString(),
  };

  return encodeURIComponent(JSON.stringify(payload));
}
