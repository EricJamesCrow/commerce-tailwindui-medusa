import * as Sentry from "@sentry/nextjs";
import { getEmailPreferencesToken } from "lib/medusa/cookies";
import { getEmailPreferencesFromToken } from "lib/medusa/email-preferences";
import { EmailPreferencesLinkForm } from "./email-preferences-form";

type Props = {
  searchParams: Promise<{ flow?: string }>;
};

export const metadata = {
  title: "Email Preferences",
};

function InvalidPreferencesLink() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white px-8 py-10 shadow-sm">
      <p className="text-sm/6 font-medium text-red-600">Invalid link</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
        This preferences link can’t be used
      </h1>
      <p className="mt-4 text-sm/6 text-gray-600">
        Please open the latest email from us and use the “manage your email
        preferences” link in the footer.
      </p>
    </div>
  );
}

export default async function EmailPreferencesPage({ searchParams }: Props) {
  const { flow } = await searchParams;
  const token = await getEmailPreferencesToken(flow);

  if (!flow || !token) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <EmailPreferencesLinkForm
          initialPreferences={null}
          initialToken={null}
        />
      </div>
    );
  }

  try {
    const preferences = await getEmailPreferencesFromToken(token);

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <EmailPreferencesLinkForm
          initialPreferences={preferences}
          initialToken={token}
        />
      </div>
    );
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        page: "email_preferences",
        state: "load_failed",
      },
      level: "warning",
    });

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <InvalidPreferencesLink />
      </div>
    );
  }
}
