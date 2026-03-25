import { describe, expect, it } from "vitest";
import {
  addressSchema,
  emailSchema,
  paymentDataSchema,
  providerIdSchema,
} from "lib/medusa/checkout-schemas";

describe("emailSchema", () => {
  it("accepts valid email and normalizes case", () => {
    const result = emailSchema.safeParse("Test@Example.COM");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("test@example.com");
  });
  it("rejects missing email", () => {
    expect(emailSchema.safeParse("").success).toBe(false);
  });
  it("rejects invalid email format", () => {
    expect(emailSchema.safeParse("notanemail").success).toBe(false);
  });
  it("trims leading and trailing whitespace", () => {
    const result = emailSchema.safeParse("  user@example.com  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("user@example.com");
  });
  it("rejects email over 254 chars", () => {
    // 249 a's + "@b.com" = 255 chars (exceeds 254 max)
    expect(emailSchema.safeParse("a".repeat(249) + "@b.com").success).toBe(false);
  });
});

describe("addressSchema", () => {
  const valid = {
    first_name: "Jane",
    last_name: "Doe",
    address_1: "123 Main St",
    city: "Anytown",
    country_code: "us",
    postal_code: "12345",
  };
  it("accepts minimal valid address", () => {
    expect(addressSchema.safeParse(valid).success).toBe(true);
  });
  it("normalizes country_code to lowercase", () => {
    const result = addressSchema.safeParse({ ...valid, country_code: "US" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.country_code).toBe("us");
  });
  it("rejects missing required fields", () => {
    expect(addressSchema.safeParse({ ...valid, address_1: "" }).success).toBe(false);
  });
  it("rejects invalid country_code", () => {
    expect(addressSchema.safeParse({ ...valid, country_code: "USA" }).success).toBe(false);
  });
});

describe("providerIdSchema", () => {
  it("accepts valid Stripe provider ID", () => {
    expect(providerIdSchema.safeParse("pp_stripe_stripe").success).toBe(true);
  });
  it("accepts system default provider", () => {
    expect(providerIdSchema.safeParse("pp_system_default").success).toBe(true);
  });
  it("rejects empty string", () => {
    expect(providerIdSchema.safeParse("").success).toBe(false);
  });
  it("rejects provider ID with special chars", () => {
    expect(providerIdSchema.safeParse("pp_stripe; DROP TABLE").success).toBe(false);
  });
});

describe("paymentDataSchema", () => {
  it("accepts undefined", () => {
    expect(paymentDataSchema.safeParse(undefined).success).toBe(true);
  });
  it("accepts plain object", () => {
    expect(
      paymentDataSchema.safeParse({ setup_future_usage: "off_session" }).success,
    ).toBe(true);
  });
  it("rejects array", () => {
    expect(paymentDataSchema.safeParse([1, 2, 3]).success).toBe(false);
  });
});
