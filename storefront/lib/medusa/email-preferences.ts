"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { trackServer } from "lib/analytics-server";
import { sdk } from "lib/medusa";
import { getAuthHeaders } from "./cookies";

const emailPreferencesSchema = z.object({
  newsletter_enabled: z.boolean(),
  order_updates_enabled: z.boolean(),
});

type EmailPreferencesInput = z.infer<typeof emailPreferencesSchema>;

type EmailPreferencesFetchError = Error & {
  status?: number;
  statusText?: string;
};

export type EmailPreferences = EmailPreferencesInput & {
  email: string;
};

export type EmailPreferencesState = {
  success?: boolean;
  error?: string;
  preferences?: EmailPreferences;
} | null;

function isEmailPreferencesFetchError(
  error: unknown,
): error is EmailPreferencesFetchError {
  return (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    ("status" in error || "statusText" in error)
  );
}

function parseCheckbox(formData: FormData, key: string): boolean {
  return formData
    .getAll(key)
    .some((value) => value === "true" || value === "on");
}

function classifyEmailPreferencesError(
  source: "account" | "email_link",
  error: unknown,
): {
  errorType: "validation" | "backend" | "unknown";
  userMessage: string;
} {
  if (error instanceof z.ZodError) {
    return {
      errorType: "validation",
      userMessage:
        "We couldn't read your selected preferences. Please try again.",
    };
  }

  if (isEmailPreferencesFetchError(error)) {
    if (error.status === 401) {
      return source === "account"
        ? {
            errorType: "validation",
            userMessage:
              "Your session expired. Please sign in again and try once more.",
          }
        : {
            errorType: "validation",
            userMessage:
              "We couldn't verify this preferences link. Please use the latest email you received.",
          };
    }

    if (error.status === 400 || error.status === 422) {
      return {
        errorType: "validation",
        userMessage:
          "We couldn't verify this preferences link. Please use the latest email you received.",
      };
    }

    if (error.status && error.status >= 500) {
      return {
        errorType: "backend",
        userMessage:
          "We couldn't save your preferences right now. Please try again shortly.",
      };
    }
  }

  return {
    errorType: "unknown",
    userMessage:
      "We couldn't save your preferences right now. Please try again shortly.",
  };
}

function getPreferencesPayload(formData: FormData): EmailPreferencesInput {
  return emailPreferencesSchema.parse({
    newsletter_enabled: parseCheckbox(formData, "newsletter_enabled"),
    order_updates_enabled: parseCheckbox(formData, "order_updates_enabled"),
  });
}

async function trackPreferencesFailure(
  source: "account" | "email_link",
  errorType: "validation" | "backend" | "unknown",
): Promise<void> {
  await trackServer("email_preferences_update_failed", {
    source,
    error_type: errorType,
  }).catch(() => {});
}

export async function getAccountEmailPreferences(): Promise<EmailPreferences> {
  const headers = await getAuthHeaders();
  const { preferences } = await sdk.client.fetch<{
    preferences: EmailPreferences;
  }>("/store/customers/me/email-preferences", {
    method: "GET",
    headers,
  });

  return preferences;
}

export async function getEmailPreferencesFromToken(
  token: string,
): Promise<EmailPreferences> {
  const { preferences } = await sdk.client.fetch<{
    preferences: EmailPreferences;
  }>("/store/newsletter/preferences", {
    method: "GET",
    query: { token },
  });

  return preferences;
}

export async function updateAccountEmailPreferences(
  _prevState: EmailPreferencesState,
  formData: FormData,
): Promise<EmailPreferencesState> {
  const headers = await getAuthHeaders();
  let payload: EmailPreferencesInput | undefined;

  try {
    payload = getPreferencesPayload(formData);
    const { preferences } = await sdk.client.fetch<{
      preferences: EmailPreferences;
    }>("/store/customers/me/email-preferences", {
      method: "POST",
      headers,
      body: payload,
    });

    await trackServer("email_preferences_updated", {
      source: "account",
      newsletter_enabled: preferences.newsletter_enabled,
      order_updates_enabled: preferences.order_updates_enabled,
    }).catch(() => {});

    revalidatePath("/account");

    return {
      success: true,
      preferences,
    };
  } catch (error) {
    const { errorType, userMessage } = classifyEmailPreferencesError(
      "account",
      error,
    );

    if (errorType === "backend" || errorType === "unknown") {
      Sentry.captureException(error, {
        tags: {
          action: "update_account_email_preferences",
          error_type: errorType,
        },
        extra: payload,
        level: "warning",
      });
    }

    await trackPreferencesFailure("account", errorType);

    return {
      error: userMessage,
    };
  }
}

export async function updateEmailPreferencesFromToken(
  _prevState: EmailPreferencesState,
  formData: FormData,
): Promise<EmailPreferencesState> {
  const token = formData.get("token");

  if (typeof token !== "string" || !token.trim()) {
    await trackPreferencesFailure("email_link", "validation");
    return {
      error:
        "This preferences link is missing or invalid. Please use the latest email you received.",
    };
  }

  let payload: EmailPreferencesInput | undefined;

  try {
    payload = getPreferencesPayload(formData);
    const { preferences } = await sdk.client.fetch<{
      preferences: EmailPreferences;
    }>("/store/newsletter/preferences", {
      method: "POST",
      body: {
        token,
        ...payload,
      },
    });

    await trackServer("email_preferences_updated", {
      source: "email_link",
      newsletter_enabled: preferences.newsletter_enabled,
      order_updates_enabled: preferences.order_updates_enabled,
    }).catch(() => {});

    revalidatePath("/email-preferences");

    return {
      success: true,
      preferences,
    };
  } catch (error) {
    const { errorType, userMessage } = classifyEmailPreferencesError(
      "email_link",
      error,
    );

    if (errorType === "backend" || errorType === "unknown") {
      Sentry.captureException(error, {
        tags: {
          action: "update_email_preferences_from_link",
          error_type: errorType,
        },
        extra: payload,
        level: "warning",
      });
    }

    await trackPreferencesFailure("email_link", errorType);

    return {
      error: userMessage,
    };
  }
}
