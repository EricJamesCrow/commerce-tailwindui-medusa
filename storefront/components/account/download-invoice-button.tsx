"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";

type DownloadState = "idle" | "loading" | "error";

function parseFilenameFromHeader(header: string | null): string {
  if (!header) return "invoice.pdf";
  const match = header.match(/filename="?([^";\s]+)"?/);
  return match?.[1] ?? "invoice.pdf";
}

export function DownloadInvoiceButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<DownloadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setState("loading");
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`, {
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ||
            `Failed to generate invoice (${res.status})`,
        );
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = parseFilenameFromHeader(
        res.headers.get("content-disposition"),
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setState("idle");
    } catch (err) {
      const isTimeout =
        err instanceof DOMException && err.name === "TimeoutError";

      let message = "Failed to download invoice";
      if (isTimeout) {
        message = "Invoice generation timed out — please try again";
      } else if (err instanceof Error) {
        message = err.message;
      }

      setErrorMessage(message);
      setState("error");
    }
  }, [orderId]);

  return (
    <div className="flex items-center gap-x-3">
      <button
        type="button"
        onClick={handleDownload}
        disabled={state === "loading"}
        className={clsx(
          "inline-flex items-center gap-x-1.5 text-sm font-medium",
          state === "loading"
            ? "cursor-wait text-gray-400"
            : "text-primary-600 hover:text-primary-500",
        )}
      >
        {state === "loading" ? (
          <>
            <svg
              className="size-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Generating...
          </>
        ) : (
          <>
            <svg
              className="size-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            Download Invoice
          </>
        )}
      </button>

      {state === "error" && errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
