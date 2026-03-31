"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { reorder } from "lib/medusa/reorder";
import { trackClient } from "lib/analytics";

type ReorderState = "idle" | "loading" | "error";

export function ReorderButton({
  orderId,
  className,
}: {
  orderId: string;
  className?: string;
}) {
  const [state, setState] = useState<ReorderState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleReorder = useCallback(async () => {
    setState("loading");
    setErrorMessage(null);
    trackClient("reorder_initiated", { order_id: orderId });

    const result = await reorder(orderId);

    if ("error" in result) {
      trackClient("reorder_failed", {
        order_id: orderId,
        error_code: result.error_code,
      });
      setErrorMessage(result.error);
      setState("error");
      return;
    }

    router.push("/checkout");
  }, [orderId, router]);

  return (
    <div className="flex flex-col items-start gap-y-2">
      <button
        type="button"
        onClick={handleReorder}
        disabled={state === "loading"}
        className={clsx(
          "inline-flex items-center gap-x-1.5 text-sm font-medium",
          state === "loading"
            ? "cursor-wait text-gray-400"
            : "text-primary-600 hover:text-primary-500 cursor-pointer",
          className,
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
            Reordering...
          </>
        ) : (
          "Reorder"
        )}
      </button>

      {state === "error" && errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
