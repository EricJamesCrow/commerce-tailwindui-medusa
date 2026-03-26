import { describe, expect, it } from "vitest";
import { redactPiiFromQuery } from "lib/analytics";

describe("redactPiiFromQuery", () => {
  it("replaces email-only queries with the email placeholder", () => {
    expect(redactPiiFromQuery("person@example.com")).toBe("[email]");
  });

  it("replaces US phone numbers with the phone placeholder", () => {
    expect(redactPiiFromQuery("(415) 555-1212")).toBe("[phone]");
  });

  it("preserves non-PII terms while redacting mixed email and phone content", () => {
    expect(
      redactPiiFromQuery(
        "linen shirt contact jane@example.com or 415-555-1212 today",
      ),
    ).toBe("linen shirt contact [email] or [phone] today");
  });

  it("trims leading and trailing whitespace", () => {
    expect(redactPiiFromQuery("   linen shirt   ")).toBe("linen shirt");
  });

  it("truncates to 80 characters after replacements", () => {
    const query = `person@example.com ${"x".repeat(100)}`;
    const redacted = redactPiiFromQuery(query);

    expect(redacted).toHaveLength(80);
    expect(redacted).toBe(`[email] ${"x".repeat(72)}`);
  });

  it("leaves clean inputs unchanged apart from normalization and truncation", () => {
    expect(redactPiiFromQuery("cotton tee")).toBe("cotton tee");
    expect(redactPiiFromQuery(`  ${"y".repeat(90)}  `)).toBe("y".repeat(80));
  });
});
