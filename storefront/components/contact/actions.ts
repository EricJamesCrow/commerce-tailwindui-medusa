"use server";

import * as Sentry from "@sentry/nextjs";
import { trackServer } from "lib/analytics-server";
import { sdk } from "lib/medusa";
import { getAuthHeaders } from "lib/medusa/cookies";
import { z } from "zod";

const contactFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .transform((value) => value.toLowerCase()),
  subject: z.string().trim().min(3, "Subject is too short").max(120),
  message: z.string().trim().min(20, "Message is too short").max(5000),
  company: z.string().trim().optional().default(""),
});

type ContactFormValues = z.input<typeof contactFormSchema>;
type ContactSubmission = z.output<typeof contactFormSchema>;
type ContactFormField = Exclude<keyof ContactSubmission, "company">;
type ContactFormErrorType =
  | "validation"
  | "rate_limited"
  | "backend"
  | "unknown";

export type ContactFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<ContactFormField, string>>;
  values?: Partial<ContactFormValues>;
} | null;

type ContactFetchError = Error & {
  status?: number;
  statusText?: string;
};

function getStringField(
  formData: FormData,
  key: keyof ContactFormValues,
): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getFormValues(formData: FormData): ContactFormValues {
  return {
    first_name: getStringField(formData, "first_name"),
    last_name: getStringField(formData, "last_name"),
    email: getStringField(formData, "email"),
    subject: getStringField(formData, "subject"),
    message: getStringField(formData, "message"),
    company: getStringField(formData, "company"),
  };
}

function getFieldErrors(
  error: z.ZodError<ContactFormValues>,
): Partial<Record<ContactFormField, string>> {
  const flattened = error.flatten().fieldErrors;

  return {
    first_name: flattened.first_name?.[0],
    last_name: flattened.last_name?.[0],
    email: flattened.email?.[0],
    subject: flattened.subject?.[0],
    message: flattened.message?.[0],
  };
}

function getMessageLengthBucket(message: string): "short" | "medium" | "long" {
  if (message.length < 100) return "short";
  if (message.length < 400) return "medium";
  return "long";
}

function isContactFetchError(error: unknown): error is ContactFetchError {
  return (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    ("status" in error || "statusText" in error)
  );
}

function classifyContactError(error: unknown): {
  errorType: ContactFormErrorType;
  userMessage: string;
} {
  if (isContactFetchError(error)) {
    if (error.status === 429) {
      return {
        errorType: "rate_limited",
        userMessage:
          "You're sending messages too quickly. Please try again soon.",
      };
    }

    if (error.status === 400 || error.status === 422) {
      return {
        errorType: "validation",
        userMessage: "Please check your message details and try again.",
      };
    }

    if (error.status && error.status >= 500) {
      return {
        errorType: "backend",
        userMessage:
          "We couldn't send your message right now. Please try again later.",
      };
    }
  }

  return {
    errorType: "unknown",
    userMessage:
      "We couldn't send your message right now. Please try again later.",
  };
}

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = getFormValues(formData);
  const parsed = contactFormSchema.safeParse(values);

  if (!parsed.success) {
    await trackServer("contact_form_failed", {
      source: "contact_page",
      error_type: "validation",
    }).catch(() => {});

    return {
      error: "Please fix the highlighted fields and try again.",
      fieldErrors: getFieldErrors(parsed.error),
      values,
    };
  }

  const payload = parsed.data;
  const headers = await getAuthHeaders();
  const analyticsPayload = {
    source: "contact_page" as const,
    subject_length: payload.subject.length,
    message_length_bucket: getMessageLengthBucket(payload.message),
  };

  try {
    await sdk.client.fetch<{ success: true }>("/store/contact", {
      method: "POST",
      headers,
      body: payload,
    });

    await trackServer("contact_form_submitted", analyticsPayload).catch(
      () => {},
    );

    return { success: true };
  } catch (error) {
    const { errorType, userMessage } = classifyContactError(error);

    if (errorType === "backend" || errorType === "unknown") {
      Sentry.captureException(error, {
        tags: {
          action: "contact_form_submit",
          error_type: errorType,
        },
        extra: analyticsPayload,
        level: "warning",
      });
    }

    await trackServer("contact_form_failed", {
      source: "contact_page",
      error_type: errorType,
    }).catch(() => {});

    return {
      error: userMessage,
      values,
    };
  }
}
