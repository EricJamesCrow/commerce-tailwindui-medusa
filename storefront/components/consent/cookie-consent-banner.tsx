"use client";

import { type StorefrontConsentState } from "lib/consent/shared";

type CookieConsentBannerProps = {
  consent: StorefrontConsentState;
  isOpen: boolean;
  onAcceptAnalytics: () => void;
  onDeclineAnalytics: () => void;
  onOpenPreferences: () => void;
  onClose: () => void;
};

export function CookieConsentBanner({
  consent,
  isOpen,
  onAcceptAnalytics,
  onDeclineAnalytics,
  onOpenPreferences,
  onClose,
}: CookieConsentBannerProps) {
  if (!isOpen) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-start px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenPreferences}
          className="pointer-events-auto inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-400 hover:text-stone-900"
        >
          Privacy settings
        </button>
      </div>
    );
  }

  const analyticsEnabled = consent.analytics === "granted";
  const hasDecision = consent.analytics !== "pending";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-3xl space-y-3">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
              Cookie preferences
            </p>
            <h2 className="mt-1 text-lg font-semibold text-stone-900">
              Essential store cookies stay on. Analytics only turns on if you
              say yes.
            </h2>
          </div>
          <p className="text-sm leading-6 text-stone-600">
            We persist campaign parameters for later checkout and form
            attribution with first-party storage. PostHog pageviews and session
            replay stay disabled until analytics consent is granted.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-stone-500">
            <span className="rounded-full bg-stone-100 px-3 py-1">
              Essential: always active
            </span>
            <span
              className={`rounded-full px-3 py-1 ${
                analyticsEnabled
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              Analytics: {analyticsEnabled ? "allowed" : "blocked"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {hasDecision ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
            >
              Close
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDeclineAnalytics}
            className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
          >
            Only essentials
          </button>
          <button
            type="button"
            onClick={onAcceptAnalytics}
            className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
