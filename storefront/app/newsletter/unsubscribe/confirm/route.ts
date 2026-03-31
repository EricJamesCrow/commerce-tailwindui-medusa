import { NextRequest, NextResponse } from "next/server";
import { sanitizeEnvUrl, sanitizeEnvValue } from "lib/env";
import {
  NEWSLETTER_UNSUBSCRIBE_FLOW_PARAM,
  getExpiredNewsletterUnsubscribeCookieOptions,
  getNewsletterUnsubscribeCookieName,
  isValidNewsletterUnsubscribeFlowId,
} from "lib/newsletter-unsubscribe-cookie";

const MEDUSA_BACKEND_URL = sanitizeEnvUrl(
  process.env.MEDUSA_BACKEND_URL,
  "http://localhost:9000",
);
const MEDUSA_PUBLISHABLE_KEY = sanitizeEnvValue(
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
);

function redirectToStatus(
  request: NextRequest,
  status?: "success" | "invalid-token" | "error",
) {
  const url = new URL("/newsletter/unsubscribe", request.url);

  if (status) {
    url.searchParams.set("status", status);
  }

  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const rawFlowId = formData.get(NEWSLETTER_UNSUBSCRIBE_FLOW_PARAM);
  const flowId =
    typeof rawFlowId === "string" &&
    isValidNewsletterUnsubscribeFlowId(rawFlowId)
      ? rawFlowId
      : undefined;
  const token = flowId
    ? request.cookies.get(getNewsletterUnsubscribeCookieName(flowId))?.value
    : undefined;

  if (!flowId || !token) {
    return redirectToStatus(request);
  }

  try {
    const fetchResponse = await fetch(
      `${MEDUSA_BACKEND_URL}/store/newsletter/unsubscribe`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(MEDUSA_PUBLISHABLE_KEY
            ? { "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY }
            : {}),
        },
        body: JSON.stringify({ token }),
        cache: "no-store",
      },
    );

    if (fetchResponse.ok) {
      const successResponse = redirectToStatus(request, "success");
      successResponse.cookies.set(
        getNewsletterUnsubscribeCookieName(flowId),
        "",
        getExpiredNewsletterUnsubscribeCookieOptions(),
      );
      return successResponse;
    }

    const rawBody = await fetchResponse.text().catch(() => "");
    let errorMessage = rawBody;

    try {
      const body = JSON.parse(rawBody) as { message?: string; error?: string };
      errorMessage = body.message ?? body.error ?? rawBody;
    } catch {
      errorMessage = rawBody;
    }

    const isInvalidToken =
      fetchResponse.status === 400 ||
      errorMessage.includes("Invalid or expired");
    const redirectResponse = redirectToStatus(
      request,
      isInvalidToken ? "invalid-token" : "error",
    );

    if (isInvalidToken) {
      redirectResponse.cookies.set(
        getNewsletterUnsubscribeCookieName(flowId),
        "",
        getExpiredNewsletterUnsubscribeCookieOptions(),
      );
    }

    return redirectResponse;
  } catch {
    return redirectToStatus(request, "error");
  }
}
