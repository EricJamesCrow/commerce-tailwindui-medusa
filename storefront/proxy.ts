import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

const PH_ANON_COOKIE = "_ph_anon_id";
export const PH_ANON_HEADER = "x-ph-anon-id";

function sanitizeEnvUrl(value: string | undefined, fallback = ""): string {
  return value?.replace(/[\r\n]+/g, "").trim() || fallback;
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const backendUrl = sanitizeEnvUrl(
    process.env.MEDUSA_BACKEND_URL,
    "http://localhost:9000",
  );
  const meilisearchHost = sanitizeEnvUrl(
    process.env.NEXT_PUBLIC_MEILISEARCH_HOST,
  );

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://js.stripe.com",
    isDev ? "'unsafe-eval'" : "", // Next.js Turbopack HMR requires eval in dev
  ]
    .filter(Boolean)
    .join(" ");

  const connectSrc = [
    "'self'", // Covers PostHog — proxied via /api/ph/* (see next.config.ts rewrites)
    backendUrl,
    "https://*.sentry.io",
    "https://sentry.io",
    "https://*.stripe.com", // Stripe SDK makes direct API calls beyond the iframe
    "https://m.stripe.com",
    meilisearchHost,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // Tailwind CSS requires unsafe-inline
    "img-src 'self' data: blob: https:", // Allow any HTTPS image (product CDNs vary)
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const existingId = request.cookies.get(PH_ANON_COOKIE)?.value;
  const anonId = existingId || randomUUID();
  const nonce = Buffer.from(randomUUID()).toString("base64");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PH_ANON_HEADER, anonId);
  requestHeaders.set("x-nonce", nonce); // Next.js App Router reads this for its own inline scripts

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!existingId) {
    response.cookies.set(PH_ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  response.headers.set("Content-Security-Policy", buildCsp(nonce));

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
