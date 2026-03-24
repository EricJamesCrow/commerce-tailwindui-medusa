import * as Sentry from "@sentry/nextjs"
import { getAuthHeaders } from "lib/medusa/cookies";
import { trackServer } from "lib/analytics-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // Validate order ID format before forwarding to backend
  if (!/^order_[a-zA-Z0-9]+$/.test(id)) {
    return NextResponse.json(
      { error: "Invalid order ID format" },
      { status: 400 },
    );
  }

  const headers = await getAuthHeaders();
  if (!headers.authorization) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const baseUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  try {
    const res = await fetch(`${baseUrl}/store/orders/${id}/invoice`, {
      method: "GET",
      headers: {
        ...headers,
        ...(publishableKey && { "x-publishable-api-key": publishableKey }),
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Only report server errors — 4xx are expected (auth, not-found, no items)
      if (res.status >= 500) {
        Sentry.captureException(new Error(`Invoice generation failed (${res.status})`), { tags: { action: "invoice_download", order_id: id } })
      }
      return NextResponse.json(
        { error: (err as { message?: string }).message || `Invoice generation failed (${res.status})` },
        { status: res.status },
      );
    }

    const pdfBuffer = await res.arrayBuffer();
    const contentDisposition =
      res.headers.get("content-disposition") ||
      `attachment; filename="invoice.pdf"`;

    try { await trackServer("invoice_downloaded", { order_id: id }) } catch {}

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "invoice_download", order_id: id } })
    const isTimeout =
      err instanceof DOMException && err.name === "TimeoutError";

    let message = "Invoice generation failed";
    if (isTimeout) {
      message = "Invoice generation timed out";
    } else if (err instanceof Error) {
      message = err.message;
    }

    return NextResponse.json(
      { error: message },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
