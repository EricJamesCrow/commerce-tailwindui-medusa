import { getAuthHeaders } from "lib/medusa/cookies";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

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
      return NextResponse.json(
        { error: (err as { message?: string }).message || `Invoice generation failed (${res.status})` },
        { status: res.status },
      );
    }

    const pdfBuffer = await res.arrayBuffer();
    const contentDisposition =
      res.headers.get("content-disposition") ||
      `attachment; filename="invoice.pdf"`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (err) {
    const isTimeout =
      err instanceof DOMException && err.name === "TimeoutError";
    const message = isTimeout
      ? "Invoice generation timed out"
      : err instanceof Error
        ? err.message
        : "Invoice generation failed";
    return NextResponse.json(
      { error: message },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
