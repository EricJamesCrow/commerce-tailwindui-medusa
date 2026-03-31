import { randomBytes } from "node:crypto";

const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type IssuedUnsubscribeToken = {
  token: string;
  expiresAt: Date;
};

export function issueUnsubscribeToken(
  now = new Date(),
): IssuedUnsubscribeToken {
  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(now.getTime() + TOKEN_EXPIRY_MS),
  };
}

export function isUnsubscribeTokenExpired(
  expiresAt?: Date | null,
  now = new Date(),
): boolean {
  if (!expiresAt) {
    return true;
  }

  return expiresAt.getTime() <= now.getTime();
}
