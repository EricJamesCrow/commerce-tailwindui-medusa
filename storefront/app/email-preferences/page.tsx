import * as Sentry from "@sentry/nextjs";
import { getEmailPreferencesFromToken } from "lib/medusa/email-preferences";
import {
  EmailPreferencesLinkForm,
  EMAIL_PREFERENCES_STORAGE_KEY,
  EMAIL_PREFERENCES_TOKEN_STORAGE_KEY,
} from "./email-preferences-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
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
  const { token } = await searchParams;

  if (!token) {
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
    const serializedToken = JSON.stringify(token);
    const serializedPreferences = JSON.stringify(preferences);

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              sessionStorage.setItem(
                ${JSON.stringify(EMAIL_PREFERENCES_TOKEN_STORAGE_KEY)},
                ${serializedToken}
              );
              sessionStorage.setItem(
                ${JSON.stringify(EMAIL_PREFERENCES_STORAGE_KEY)},
                ${serializedPreferences}
              );
              window.location.replace("/email-preferences");
            `,
          }}
        />
        <div className="mx-auto w-full max-w-2xl rounded-3xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
          <p className="text-primary-600 text-sm/6 font-medium">
            Email preferences
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
            Preparing your secure preferences page
          </h1>
          <p className="mt-4 text-sm/6 text-gray-600">
            Redirecting to a clean preferences URL.
          </p>
        </div>
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
