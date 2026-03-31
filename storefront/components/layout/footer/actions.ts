"use server";

import { sdk } from "lib/medusa";
import { getAuthHeaders } from "lib/medusa/cookies";
import { trackServer } from "lib/analytics-server";
import * as Sentry from "@sentry/nextjs";

export type NewsletterResult = {
  success?: boolean;
  error?: string;
} | null;

export async function subscribeToNewsletter(input: {
  email: string;
  company?: string;
}): Promise<NewsletterResult> {
  const headers = await getAuthHeaders();
  const email = input.email.toLowerCase();

  try {
    await sdk.client.fetch<{ success: true }>("/store/newsletter/subscribe", {
      method: "POST",
      headers,
      body: {
        company: input.company,
        email,
        source: "footer" as const,
      },
    });

    await trackServer("newsletter_subscribed", {
      source: "footer",
    }).catch(() => {});

    return { success: true };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { action: "newsletter_subscribe" },
      level: "warning",
    });
    const errorMessage = e instanceof Error ? e.message : "Subscription failed";

    await trackServer("newsletter_subscribe_failed", {
      source: "footer",
      error: errorMessage,
    }).catch(() => {});

    return { error: errorMessage };
  }
}
