const EMAIL_PREFERENCES_TOKEN_MAX_AGE_SECONDS = 60 * 10;

const EMAIL_PREFERENCES_COOKIE_PREFIX = "_email_preferences_flow_";
const EMAIL_PREFERENCES_FLOW_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const EMAIL_PREFERENCES_COOKIE_PATH = "/";
export const EMAIL_PREFERENCES_FLOW_PARAM = "flow";

export function getEmailPreferencesCookieName(flowId: string) {
  return `${EMAIL_PREFERENCES_COOKIE_PREFIX}${flowId}`;
}

export function isValidEmailPreferencesFlowId(
  flowId: string | null | undefined,
): flowId is string {
  return Boolean(flowId && EMAIL_PREFERENCES_FLOW_ID_PATTERN.test(flowId));
}

export function getEmailPreferencesCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: EMAIL_PREFERENCES_COOKIE_PATH,
    maxAge: EMAIL_PREFERENCES_TOKEN_MAX_AGE_SECONDS,
  };
}

export function getExpiredEmailPreferencesCookieOptions() {
  return {
    ...getEmailPreferencesCookieOptions(),
    maxAge: 0,
  };
}
