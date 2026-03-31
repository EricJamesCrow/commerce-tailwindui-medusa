import { MedusaError } from "@medusajs/framework/utils";
import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { resolveStorefrontUrl } from "../subscribers/_helpers/resolve-urls";

const EMAIL_PREFERENCES_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const EMAIL_PREFERENCES_TOKEN_TYPE = "email_preferences";

type EmailPreferencesTokenPayload = {
  email: string;
  type: typeof EMAIL_PREFERENCES_TOKEN_TYPE;
};

function getEmailPreferencesSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "test") {
    return "test-email-preferences-secret";
  }

  throw new Error(
    "JWT_SECRET is required to issue or verify email preferences tokens",
  );
}

export function issueEmailPreferencesToken(email: string): string {
  return jwt.sign(
    {
      email: email.trim().toLowerCase(),
      type: EMAIL_PREFERENCES_TOKEN_TYPE,
    } satisfies EmailPreferencesTokenPayload,
    getEmailPreferencesSecret(),
    {
      expiresIn: EMAIL_PREFERENCES_TOKEN_TTL_SECONDS,
    },
  );
}

export function verifyEmailPreferencesToken(token: string): string {
  try {
    const decoded = jwt.verify(
      token,
      getEmailPreferencesSecret(),
    ) as EmailPreferencesTokenPayload;

    if (
      decoded.type !== EMAIL_PREFERENCES_TOKEN_TYPE ||
      typeof decoded.email !== "string"
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid or expired email preferences token",
      );
    }

    return decoded.email.trim().toLowerCase();
  } catch (error) {
    if (
      error instanceof TokenExpiredError ||
      error instanceof JsonWebTokenError ||
      error instanceof MedusaError
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid or expired email preferences token",
      );
    }

    throw error;
  }
}

export function buildEmailPreferencesUrl(email: string): string | null {
  const storefrontUrl = resolveStorefrontUrl();
  if (!storefrontUrl) {
    console.warn(
      "[email-preferences-token] STOREFRONT_URL not configured; skipping preferences link injection",
    );
    return null;
  }

  const token = issueEmailPreferencesToken(email);
  return `${storefrontUrl}/email-preferences?token=${encodeURIComponent(token)}`;
}
