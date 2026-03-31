"use client";

import { useActionState, useEffect, useState } from "react";
import { unsubscribeNewsletter } from "./actions";

type Result = { success?: boolean; error?: string } | null;
const UNSUBSCRIBE_TOKEN_STORAGE_KEY = "__newsletter_unsubscribe_token";

export function UnsubscribeForm({ token }: { token: string | null }) {
  const [initialToken, setInitialToken] = useState(token);
  const [state, formAction, isPending] = useActionState<Result, FormData>(
    async (_previousState, formData) => {
      const submittedToken = formData.get("token");

      if (typeof submittedToken !== "string" || submittedToken.length === 0) {
        return { error: "Unable to process your request" };
      }

      return unsubscribeNewsletter(submittedToken);
    },
    null,
  );

  useEffect(() => {
    if (initialToken) {
      return;
    }

    const storedToken = sessionStorage.getItem(UNSUBSCRIBE_TOKEN_STORAGE_KEY);

    if (storedToken) {
      setInitialToken(storedToken);
    }
  }, [initialToken]);

  useEffect(() => {
    if (!state?.success) {
      return;
    }

    sessionStorage.removeItem(UNSUBSCRIBE_TOKEN_STORAGE_KEY);
  }, [state?.success]);

  if (!initialToken) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Invalid Link</h1>
          <p className="mt-2 text-gray-500">
            This unsubscribe link is missing or malformed.
          </p>
        </div>
      </div>
    );
  }

  if (state?.success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            You've been unsubscribed
          </h1>
          <p className="mt-2 text-gray-500">
            You won't receive any more newsletter emails from us.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        {state?.error ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-gray-500">
              {state.error.includes("expired")
                ? "This unsubscribe link has expired. Please use the link in your most recent email."
                : "We couldn't process your request. Please try again or contact support."}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900">
              Unsubscribe from newsletter
            </h1>
            <p className="mt-2 text-gray-500">
              Click below to stop receiving newsletter emails.
            </p>
            <form action={formAction} className="mt-6">
              <input type="hidden" name="token" value={initialToken} />
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary-600 hover:bg-primary-700 rounded-md px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isPending ? "Unsubscribing..." : "Confirm unsubscribe"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
