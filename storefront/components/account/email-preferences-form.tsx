"use client";

import { useActionState, useEffect, useRef } from "react";
import { useNotification } from "components/notifications";
import {
  updateAccountEmailPreferences,
  type EmailPreferences,
  type EmailPreferencesState,
} from "lib/medusa/email-preferences";

type EmailPreferencesFormProps = {
  preferences: EmailPreferences;
};

export function EmailPreferencesForm({
  preferences,
}: EmailPreferencesFormProps) {
  const [state, formAction, isPending] = useActionState<
    EmailPreferencesState,
    FormData
  >(updateAccountEmailPreferences, null);
  const { showNotification } = useNotification();
  const handledState = useRef<EmailPreferencesState>(null);

  useEffect(() => {
    if (!state || handledState.current === state) {
      return;
    }

    handledState.current = state;

    if (state.success) {
      showNotification(
        "success",
        "Email preferences updated",
        "Your communication settings were saved.",
      );
      return;
    }

    if (state.error) {
      showNotification("error", "Could not save preferences", state.error);
    }
  }, [showNotification, state]);

  return (
    <form action={formAction} className="mt-10">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <h2 className="text-base/7 font-semibold text-gray-900">
            Email Preferences
          </h2>
          <p className="mt-1 text-sm/6 text-gray-600">
            Choose which messages we send to {preferences.email}.
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
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
                Receive launches, editorial updates, and promotional offers.
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
                Receive email notifications about order confirmation, shipping,
                and delivery status.
              </span>
            </span>
          </label>

          {state?.error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end border-t border-gray-200 px-6 py-4">
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
