"use client";

import { type StorefrontConsentState } from "lib/consent/shared";

type CookieConsentBannerProps = {
  consent: StorefrontConsentState;
  isOpen: boolean;
  onAcceptAnalytics: () => void;
  onDeclineAnalytics: () => void;
  onClose: () => void;
};

export function CookieConsentBanner({
  consent,
  isOpen,
  onAcceptAnalytics,
  onDeclineAnalytics,
  onClose,
}: CookieConsentBannerProps) {
  if (!isOpen) {
    return null;
  }

  const analyticsEnabled = consent.analytics === "granted";
  const hasDecision = consent.analytics !== "pending";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 sm:px-6 sm:pb-5 lg:px-8">
      <div className="pointer-events-auto flex flex-col gap-4 bg-gray-900 px-6 py-5 sm:flex-row sm:items-end sm:justify-between sm:rounded-xl sm:py-4 sm:pr-4 sm:pl-6">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-white">
            Essential cookies stay on. Analytics only with your consent.
          </p>
          <p className="mt-1 text-sm leading-6 text-white/60">
            We use first-party storage for campaign attribution. PostHog
            pageviews and session replay stay off until you say yes.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white/80 ring-1 ring-white/20 ring-inset">
              Essential: always active
            </span>
            <span
              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                analyticsEnabled
                  ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                  : "bg-white/10 text-white/60 ring-white/20"
              }`}
            >
              Analytics: {analyticsEnabled ? "allowed" : "blocked"}
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-x-4">
          {hasDecision ? (
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-white/70 transition hover:text-white"
            >
              Close
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDeclineAnalytics}
            className="text-sm font-semibold text-white transition hover:text-white/80"
          >
            Only essentials
          </button>
          <button
            type="button"
            onClick={onAcceptAnalytics}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
