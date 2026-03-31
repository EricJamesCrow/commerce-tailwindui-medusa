import { describe, expect, it } from "vitest";
import {
  DEFAULT_STOREFRONT_CONSENT,
  createStorefrontConsentState,
  hasStoredConsentDecision,
  isStorefrontConsentFoundationEnabled,
  isAnalyticsConsentGranted,
  parseStorefrontConsentCookie,
  serializeStorefrontConsentCookie,
} from "lib/consent/shared";
import { afterEach, beforeEach } from "vitest";

describe("storefront consent helpers", () => {
  const originalFlag = process.env.NEXT_PUBLIC_CONSENT_FOUNDATION_ENABLED;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONSENT_FOUNDATION_ENABLED = originalFlag;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_CONSENT_FOUNDATION_ENABLED = originalFlag;
  });

  it("returns the default pending state when no cookie exists", () => {
    expect(parseStorefrontConsentCookie(null)).toEqual(
      DEFAULT_STOREFRONT_CONSENT,
    );
  });

  it("round-trips a granted consent cookie", () => {
    const granted = createStorefrontConsentState(
      "granted",
      "2026-03-30T12:00:00.000Z",
    );

    expect(
      parseStorefrontConsentCookie(serializeStorefrontConsentCookie(granted)),
    ).toEqual(granted);
  });

  it("returns pending for invalid cookie payloads", () => {
    expect(parseStorefrontConsentCookie("not-json")).toEqual(
      DEFAULT_STOREFRONT_CONSENT,
    );
  });

  it("tracks whether analytics is enabled", () => {
    const granted = createStorefrontConsentState("granted");
    const denied = createStorefrontConsentState("denied");

    expect(hasStoredConsentDecision(granted)).toBe(true);
    expect(hasStoredConsentDecision(denied)).toBe(true);
    expect(hasStoredConsentDecision(DEFAULT_STOREFRONT_CONSENT)).toBe(false);
    expect(isAnalyticsConsentGranted(granted)).toBe(true);
    expect(isAnalyticsConsentGranted(denied)).toBe(false);
  });

  it("defaults the consent foundation flag to enabled and allows explicit disable", () => {
    delete process.env.NEXT_PUBLIC_CONSENT_FOUNDATION_ENABLED;
    expect(isStorefrontConsentFoundationEnabled()).toBe(true);

    process.env.NEXT_PUBLIC_CONSENT_FOUNDATION_ENABLED = "false";
    expect(isStorefrontConsentFoundationEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_CONSENT_FOUNDATION_ENABLED = "true";
    expect(isStorefrontConsentFoundationEnabled()).toBe(true);
  });
});
