const NEWSLETTER_UNSUBSCRIBE_TOKEN_MAX_AGE_SECONDS = 60 * 10;

export const NEWSLETTER_UNSUBSCRIBE_COOKIE = "_newsletter_unsubscribe_token";
export const NEWSLETTER_UNSUBSCRIBE_COOKIE_PATH = "/";

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
