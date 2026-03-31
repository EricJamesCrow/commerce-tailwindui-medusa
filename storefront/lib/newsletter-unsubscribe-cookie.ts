const NEWSLETTER_UNSUBSCRIBE_TOKEN_MAX_AGE_SECONDS = 60 * 10;

const NEWSLETTER_UNSUBSCRIBE_COOKIE_PREFIX = "_newsletter_unsubscribe_flow_";
const NEWSLETTER_UNSUBSCRIBE_FLOW_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const NEWSLETTER_UNSUBSCRIBE_COOKIE_PATH = "/";
export const NEWSLETTER_UNSUBSCRIBE_FLOW_PARAM = "flow";

export function getNewsletterUnsubscribeCookieName(flowId: string) {
  return `${NEWSLETTER_UNSUBSCRIBE_COOKIE_PREFIX}${flowId}`;
}

export function isValidNewsletterUnsubscribeFlowId(
  flowId: string | null | undefined,
): flowId is string {
  return Boolean(flowId && NEWSLETTER_UNSUBSCRIBE_FLOW_ID_PATTERN.test(flowId));
}

export function getNewsletterUnsubscribeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: NEWSLETTER_UNSUBSCRIBE_COOKIE_PATH,
    maxAge: NEWSLETTER_UNSUBSCRIBE_TOKEN_MAX_AGE_SECONDS,
  };
}

export function getExpiredNewsletterUnsubscribeCookieOptions() {
  return {
    ...getNewsletterUnsubscribeCookieOptions(),
    maxAge: 0,
  };
}
