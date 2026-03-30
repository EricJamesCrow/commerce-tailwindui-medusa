import { describe, expect, it } from "vitest";
import { stripUnsubscribeTokenFromPath } from "app/newsletter/unsubscribe/url";

describe("stripUnsubscribeTokenFromPath", () => {
  it("removes the unsubscribe token query parameter", () => {
    expect(
      stripUnsubscribeTokenFromPath(
        "https://shop.example/newsletter/unsubscribe?token=secret",
      ),
    ).toBe("/newsletter/unsubscribe");
  });

  it("preserves unrelated query params and hash fragments", () => {
    expect(
      stripUnsubscribeTokenFromPath(
        "https://shop.example/newsletter/unsubscribe?token=secret&utm=email#top",
      ),
    ).toBe("/newsletter/unsubscribe?utm=email#top");
  });

  it("leaves clean URLs unchanged", () => {
    expect(
      stripUnsubscribeTokenFromPath(
        "https://shop.example/newsletter/unsubscribe?utm=email",
      ),
    ).toBe("/newsletter/unsubscribe?utm=email");
  });
});
