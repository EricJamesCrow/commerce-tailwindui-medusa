"use client";

import { useOptionalStorefrontConsent } from "components/consent/consent-provider";

export default function FooterCopyright({
  companyName,
}: {
  companyName: string | undefined;
}) {
  const currentYear = new Date().getFullYear();
  const consent = useOptionalStorefrontConsent();

  return (
    <p className="text-sm text-gray-500">
      &copy; {currentYear} {companyName} All rights reserved.
      {consent ? (
        <>
          <span aria-hidden="true" className="mx-2">
            &middot;
          </span>
          <button
            type="button"
            onClick={consent.openPreferences}
            className="underline-offset-2 transition-colors hover:text-gray-700 hover:underline"
          >
            Cookie preferences
          </button>
        </>
      ) : null}
    </p>
  );
}
