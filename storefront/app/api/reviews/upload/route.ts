import * as Sentry from "@sentry/nextjs";
import { getAuthHeaders } from "lib/medusa/cookies";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const headers = await getAuthHeaders();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const baseUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  try {
    const res = await fetch(`${baseUrl}/store/reviews/uploads`, {
      method: "POST",
      headers: {
        ...headers,
        ...(publishableKey && { "x-publishable-api-key": publishableKey }),
      },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Only report server errors — 4xx are expected validation failures (bad MIME, size limit)
      if (res.status >= 500) {
        Sentry.captureException(
          new Error(`Review upload failed (${res.status})`),
          { tags: { action: "review_upload" } },
        );
      }
      return NextResponse.json(
        { error: err.message || `Upload failed (${res.status})` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "review_upload" } });
    const isTimeout =
      err instanceof DOMException && err.name === "TimeoutError";
    const message = isTimeout
      ? "Upload timed out"
      : err instanceof Error
        ? err.message
        : "Upload failed";
    return NextResponse.json(
      { error: message },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
