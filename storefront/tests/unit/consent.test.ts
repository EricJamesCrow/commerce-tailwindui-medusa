import { describe, expect, it } from "vitest";
import {
  DEFAULT_STOREFRONT_CONSENT,
  createStorefrontConsentState,
  hasStoredConsentDecision,
  isAnalyticsConsentGranted,
  parseStorefrontConsentCookie,
  serializeStorefrontConsentCookie,
} from "lib/consent/shared";

describe("storefront consent helpers", () => {
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
});
