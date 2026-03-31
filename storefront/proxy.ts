import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import {
  EMAIL_PREFERENCES_FLOW_PARAM,
  getEmailPreferencesCookieName,
  getEmailPreferencesCookieOptions,
} from "./lib/email-preferences-cookie";
import {
  NEWSLETTER_UNSUBSCRIBE_FLOW_PARAM,
  getNewsletterUnsubscribeCookieName,
  getNewsletterUnsubscribeCookieOptions,
} from "./lib/newsletter-unsubscribe-cookie";

const PH_ANON_COOKIE = "_ph_anon_id";
export const PH_ANON_HEADER = "x-ph-anon-id";

function redirectNewsletterUnsubscribeToken(
  request: NextRequest,
): NextResponse | null {
  if (request.nextUrl.pathname !== "/newsletter/unsubscribe") {
    return null;
  }

  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return null;
  }

  const cleanUrl = request.nextUrl.clone();
  const flowId = randomUUID();
  cleanUrl.searchParams.delete("token");
  cleanUrl.searchParams.delete("status");
  cleanUrl.searchParams.set(NEWSLETTER_UNSUBSCRIBE_FLOW_PARAM, flowId);

  const response = NextResponse.redirect(cleanUrl);
  response.cookies.set(
    getNewsletterUnsubscribeCookieName(flowId),
    token,
    getNewsletterUnsubscribeCookieOptions(),
  );
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");

  return response;
}

function redirectEmailPreferencesToken(
  request: NextRequest,
): NextResponse | null {
  if (request.nextUrl.pathname !== "/email-preferences") {
    return null;
  }

  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return null;
  }

  const cleanUrl = request.nextUrl.clone();
  const flowId = randomUUID();
  cleanUrl.searchParams.delete("token");
  cleanUrl.searchParams.set(EMAIL_PREFERENCES_FLOW_PARAM, flowId);

  const response = NextResponse.redirect(cleanUrl);
  response.cookies.set(
    getEmailPreferencesCookieName(flowId),
    token,
    getEmailPreferencesCookieOptions(),
  );
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");

  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const unsubscribeRedirect = redirectNewsletterUnsubscribeToken(request);

  if (unsubscribeRedirect) {
    return unsubscribeRedirect;
  }

  const emailPreferencesRedirect = redirectEmailPreferencesToken(request);

  if (emailPreferencesRedirect) {
    return emailPreferencesRedirect;
  }

  const existingId = request.cookies.get(PH_ANON_COOKIE)?.value;
  const anonId = existingId || randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PH_ANON_HEADER, anonId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!existingId) {
    response.cookies.set(PH_ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
