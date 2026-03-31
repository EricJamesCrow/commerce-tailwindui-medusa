import type Redis from "ioredis";
import { contactRateLimitTestUtils } from "../contact-rate-limit";

describe("contactRateLimitTestUtils", () => {
  afterEach(() => {
    contactRateLimitTestUtils.resetInProcessStore();
  });

  it("removes expired in-process entries before incrementing", () => {
    const now = Date.now();

    contactRateLimitTestUtils.upsertInProcessEntry("contact_form:stale", now);
    contactRateLimitTestUtils.upsertInProcessEntry("contact_form:fresh", now);

    const staleEntry =
      contactRateLimitTestUtils.getInProcessEntry("contact_form:stale");
    if (!staleEntry) {
      throw new Error("Expected stale entry to exist");
    }

    staleEntry.resetAt = now - 1;

    const nextEntry = contactRateLimitTestUtils.upsertInProcessEntry(
      "contact_form:fresh",
      now + 1,
    );

    expect(
      contactRateLimitTestUtils.getInProcessEntry("contact_form:stale"),
    ).toBeUndefined();
    expect(nextEntry.count).toBe(2);
  });

  it("increments Redis entries with the TTL-preserving script", async () => {
    const evalMock = jest.fn().mockResolvedValue(2);
    const client = {
      eval: evalMock,
    } as unknown as Redis;

    await expect(
      contactRateLimitTestUtils.incrementRedisEntry(
        client,
        "contact_form:127.0.0.1",
      ),
    ).resolves.toBe(2);

    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      1,
      "contact_form:127.0.0.1",
      600,
    );
  });
});
