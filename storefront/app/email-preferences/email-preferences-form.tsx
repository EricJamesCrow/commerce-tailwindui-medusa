"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useNotification } from "components/notifications";
import {
  updateEmailPreferencesFromToken,
  type EmailPreferences,
  type EmailPreferencesState,
} from "lib/medusa/email-preferences";

type EmailPreferencesLinkFormProps = {
  initialPreferences: EmailPreferences | null;
  initialToken: string | null;
};

export function EmailPreferencesLinkForm({
  initialPreferences,
  initialToken,
}: EmailPreferencesLinkFormProps) {
  const [state, formAction, isPending] = useActionState<
    EmailPreferencesState,
    FormData
  >(updateEmailPreferencesFromToken, null);
  const { showNotification } = useNotification();
  const handledState = useRef<EmailPreferencesState>(null);
  const [preferences, setPreferences] = useState<EmailPreferences | null>(
    initialPreferences,
  );

  useEffect(() => {
    if (!state || handledState.current === state) {
      return;
    }

    handledState.current = state;

    if (state.success) {
      if (state.preferences) {
        setPreferences(state.preferences);
      }

      showNotification(
        "success",
        "Preferences updated",
        "Your email communication settings were saved.",
      );
      return;
    }

    if (state.error) {
      showNotification("error", "Could not save preferences", state.error);
    }
  }, [showNotification, state]);

  if (!initialToken || !preferences) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-red-200 bg-white px-8 py-10 shadow-sm">
        <p className="text-sm/6 font-medium text-red-600">Invalid link</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
          This preferences link can&apos;t be used
        </h1>
        <p className="mt-4 text-sm/6 text-gray-600">
          Please open the latest email from us and use the “manage your email
          preferences” link in the footer.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto w-full max-w-2xl">
      <input type="hidden" name="token" value={initialToken} />
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-8 py-8">
          <p className="text-primary-600 text-sm/6 font-medium">
            Email preferences
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
            Manage what we send you
          </h1>
          <p className="mt-3 text-sm/6 text-gray-600">
            Update communication settings for {preferences.email}.
          </p>
        </div>

        <div className="space-y-6 px-8 py-8">
          <label className="flex cursor-pointer items-start gap-4">
            <input type="hidden" name="newsletter_enabled" value="false" />
            <input
              type="checkbox"
              name="newsletter_enabled"
              value="true"
              defaultChecked={preferences.newsletter_enabled}
              disabled={isPending}
              className="text-primary-600 focus:ring-primary-600 mt-1 h-4 w-4 cursor-pointer rounded border-gray-300"
            />
            <span>
              <span className="block text-sm/6 font-medium text-gray-900">
                Promotions and newsletter
              </span>
              <span className="mt-1 block text-sm/6 text-gray-600">
                Hear about launches, promotions, and newsletter updates.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-4">
            <input type="hidden" name="order_updates_enabled" value="false" />
            <input
              type="checkbox"
              name="order_updates_enabled"
              value="true"
              defaultChecked={preferences.order_updates_enabled}
              disabled={isPending}
              className="text-primary-600 focus:ring-primary-600 mt-1 h-4 w-4 cursor-pointer rounded border-gray-300"
            />
            <span>
              <span className="block text-sm/6 font-medium text-gray-900">
                Order updates
              </span>
              <span className="mt-1 block text-sm/6 text-gray-600">
                Receive order confirmation, shipment, and delivery status by
                email.
              </span>
            </span>
          </label>

          {state?.success ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Preferences saved.
            </div>
          ) : null}

          {state?.error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-8 py-5">
          <p className="text-sm/6 text-gray-500">
            You can return to this page anytime from a recent email footer.
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save preferences"}
          </button>
        </div>
      </div>
    </form>
  );
}
