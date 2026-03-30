"use client";

import { useActionState, useEffect, useRef } from "react";
import { useNotification } from "components/notifications";
import { subscribeToNewsletter, type NewsletterResult } from "./actions";

export function FooterNewsletter({
  customerEmail,
}: {
  customerEmail?: string | null;
}) {
  const { showNotification } = useNotification();
  const handledState = useRef<NewsletterResult>(null);

  const [state, formAction, isPending] = useActionState<
    NewsletterResult,
    FormData
  >(async (_prev, formData) => {
    const email = formData.get("email") as string;
    if (!email) return { error: "Email is required" };
    return subscribeToNewsletter(email);
  }, null);

  useEffect(() => {
    if (!state || handledState.current === state) {
      return;
    }

    handledState.current = state;

    if (state.success) {
      showNotification(
        "success",
        "You're subscribed!",
        "A welcome email is on its way to your inbox.",
      );
      return;
    }

    if (state.error) {
      showNotification(
        "error",
        "Subscription failed",
        "Something went wrong. Please try again.",
      );
    }
  }, [state, showNotification]);

  return (
    <div className="mt-12 md:col-span-8 md:col-start-3 md:row-start-2 md:mt-0 lg:col-span-4 lg:col-start-9 lg:row-start-1">
      <h3 className="text-sm font-medium text-gray-900">
        Sign up for our newsletter
      </h3>
      <p className="mt-6 text-sm text-gray-500">
        The latest deals and savings, sent to your inbox weekly.
      </p>

      {state?.success ? (
        <p className="mt-2 text-sm text-green-600">Thanks! Check your inbox.</p>
      ) : (
        <form action={formAction} className="mt-2 flex sm:max-w-md">
          <input
            id="email-address"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-label="Email address"
            defaultValue={customerEmail ?? ""}
            disabled={isPending}
            placeholder="Enter your email"
            className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 disabled:opacity-50 sm:text-sm/6"
          />
          <div className="ml-4 shrink-0">
            <button
              type="submit"
              disabled={isPending}
              className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 flex w-full items-center justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-xs focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {isPending ? "..." : "Sign up"}
            </button>
          </div>
        </form>
      )}

      {state?.error && (
        <p className="mt-2 text-sm text-red-600">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
