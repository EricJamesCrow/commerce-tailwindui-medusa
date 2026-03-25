"use server";

import { sdk } from "lib/medusa";

export async function unsubscribeNewsletter(
  token: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    await sdk.client.fetch("/store/newsletter/unsubscribe", {
      method: "POST",
      body: { token },
    });
    return { success: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Unable to process your request",
    };
  }
}
