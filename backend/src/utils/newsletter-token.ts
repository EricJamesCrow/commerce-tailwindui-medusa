import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getLegacySecret(): string | null {
  return process.env.NEWSLETTER_HMAC_SECRET || null;
}

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function fromBase64Url(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

// Temporary bridge for already-issued unsubscribe links until legacy emails age out.
export function verifyLegacyUnsubscribeToken(
  token: string,
): { email: string } | null {
  const secret = getLegacySecret();
  if (!secret) return null;

  const parts = token.split(":");
  if (parts.length !== 3) return null;

  const [encodedEmail, expiryStr, providedHmac] = parts;
  if (!encodedEmail || !expiryStr || !providedHmac) return null;

  const payload = `${encodedEmail}:${expiryStr}`;
  const expectedHmac = hmac(payload, secret);

  const providedBuffer = Buffer.from(providedHmac, "hex");
  const expectedBuffer = Buffer.from(expectedHmac, "hex");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  const expiry = Number.parseInt(expiryStr, 10);
  if (!Number.isFinite(expiry) || expiry <= Date.now() / 1000) {
    return null;
  }

  try {
    const email = fromBase64Url(encodedEmail).toLowerCase();
    if (!email) return null;

    return { email };
  } catch {
    return null;
  }
}

export const LEGACY_NEWSLETTER_TOKEN_EXPIRY_SECONDS = TOKEN_EXPIRY_SECONDS;
