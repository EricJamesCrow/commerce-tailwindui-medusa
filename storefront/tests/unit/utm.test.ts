import { describe, expect, it } from "vitest";
import {
  extractAttributionValues,
  getMissingAttributionValues,
  mergePersistedAttribution,
  parsePersistedAttributionCookie,
  serializePersistedAttributionCookie,
} from "lib/utm/shared";

describe("storefront attribution helpers", () => {
  it("extracts supported utm and click-id params", () => {
    const params = new URLSearchParams({
      utm_source: "newsletter",
      utm_medium: "email",
      gclid: "test-gclid",
      ignored: "value",
    });

    expect(extractAttributionValues(params)).toEqual({
      utm_source: "newsletter",
      utm_medium: "email",
      gclid: "test-gclid",
    });
  });

  it("merges current params over persisted values and preserves metadata", () => {
    const merged = mergePersistedAttribution(
      {
        utm_source: "newsletter",
        utm_campaign: "spring-sale",
        landingPath: "/collections/sale",
        firstSeenAt: "2026-03-30T12:00:00.000Z",
        lastSeenAt: "2026-03-30T12:00:00.000Z",
      },
      { fbclid: "fb-123" },
      "/product/linen-shirt",
      "2026-03-30T13:00:00.000Z",
    );

    expect(merged).toEqual({
      utm_source: "newsletter",
      utm_campaign: "spring-sale",
      fbclid: "fb-123",
      landingPath: "/collections/sale",
      firstSeenAt: "2026-03-30T12:00:00.000Z",
      lastSeenAt: "2026-03-30T13:00:00.000Z",
    });
  });

  it("builds a patch for missing query params during navigation", () => {
    expect(
      getMissingAttributionValues(
        { utm_source: "newsletter" },
        {
          utm_source: "newsletter",
          utm_campaign: "spring-sale",
          gclid: "gclid-123",
          landingPath: "/",
          firstSeenAt: "2026-03-30T12:00:00.000Z",
          lastSeenAt: "2026-03-30T12:00:00.000Z",
        },
      ),
    ).toEqual({
      utm_campaign: "spring-sale",
      gclid: "gclid-123",
    });
  });

  it("round-trips the persisted attribution cookie payload", () => {
    const attribution = {
      utm_source: "newsletter",
      utm_medium: "email",
      fbclid: "fb-123",
      landingPath: "/",
      firstSeenAt: "2026-03-30T12:00:00.000Z",
      lastSeenAt: "2026-03-30T12:30:00.000Z",
    };

    expect(
      parsePersistedAttributionCookie(
        serializePersistedAttributionCookie(attribution),
      ),
    ).toEqual(attribution);
  });
});
