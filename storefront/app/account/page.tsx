import * as Sentry from "@sentry/nextjs";
import { retrieveCustomer } from "lib/medusa/customer";
import { getAccountEmailPreferences } from "lib/medusa/email-preferences";
import { EmailPreferencesForm } from "components/account/email-preferences-form";
import { ProfileForm } from "components/account/profile-form";

export const metadata = {
  title: "My Account",
};

export default async function AccountPage() {
  const customer = await retrieveCustomer();
  const preferences = await getAccountEmailPreferences().catch((error) => {
    Sentry.withScope((scope) => {
      scope.setLevel("warning");
      scope.setTags({
        page: "account",
        section: "email_preferences",
      });
      scope.setExtra("route", "/account");
      scope.setExtra("function", "AccountPage.getAccountEmailPreferences");
      Sentry.captureException(error);
    });
    return null;
  });

  // Layout guard handles redirect — customer is always non-null here
  if (!customer) return null;

  return (
    <div>
      <h2 className="text-base/7 font-semibold text-gray-900">
        Personal Information
      </h2>
      <p className="mt-1 max-w-2xl text-sm/6 text-gray-600">
        Update your name and contact details.
      </p>
      <div className="mt-10">
        <ProfileForm customer={customer} />
      </div>

      {preferences ? (
        <EmailPreferencesForm preferences={preferences} />
      ) : (
        <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          We couldn&apos;t load your email preferences right now. Please try
          again in a moment.
        </div>
      )}
    </div>
  );
}
