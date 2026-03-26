import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validatePassword,
} from "lib/validation";

describe("validatePassword", () => {
  it("rejects passwords shorter than the minimum length", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(
      "Password must be at least 8 characters",
    );
  });

  it("accepts passwords at the minimum length", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("accepts passwords at the maximum length", () => {
    expect(validatePassword("a".repeat(MAX_PASSWORD_LENGTH))).toBeNull();
  });

  it("rejects passwords longer than the maximum length", () => {
    expect(validatePassword("a".repeat(MAX_PASSWORD_LENGTH + 1))).toBe(
      "Password must be at most 128 characters",
    );
  });
});
