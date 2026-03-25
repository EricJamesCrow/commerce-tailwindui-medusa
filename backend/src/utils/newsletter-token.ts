import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getSecret(): string {
  const secret = process.env.NEWSLETTER_HMAC_SECRET;
  if (!secret) {
    throw new Error("NEWSLETTER_HMAC_SECRET environment variable is required");
  }
  return secret;
}

function hmac(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function toBase64Url(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function fromBase64Url(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

export function signUnsubscribeToken(email: string): string {
  const encodedEmail = toBase64Url(email.toLowerCase());
  const expiry = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS;
  const payload = `${encodedEmail}:${expiry}`;
  const signature = hmac(payload);
  return `${payload}:${signature}`;
}

export function verifyUnsubscribeToken(
  token: string,
): { email: string } | null {
  const parts = token.split(":");
  if (parts.length !== 3) return null;

  const [encodedEmail, expiryStr, providedHmac] = parts;
  if (!encodedEmail || !expiryStr || !providedHmac) return null;

  // Verify HMAC with constant-time comparison
  const payload = `${encodedEmail}:${expiryStr}`;
  const expectedHmac = hmac(payload);

  const a = Buffer.from(providedHmac, "hex");
  const b = Buffer.from(expectedHmac, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Check expiry
  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry) || expiry <= Date.now() / 1000) return null;

  // Decode email
  try {
    const email = fromBase64Url(encodedEmail);
    return { email };
  } catch {
    return null;
  }
}
