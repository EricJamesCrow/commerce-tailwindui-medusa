"use server";

import { sdk } from "lib/medusa";
import { TAGS } from "lib/constants";
import { setCartId, getAuthHeaders } from "lib/medusa/cookies";
import * as Sentry from "@sentry/nextjs";
import { revalidatePath, revalidateTag } from "next/cache";

// The backend returns only the fields needed to set the cart — not the full
// StoreCart shape. Using a narrow type prevents callers from expecting fields
// like cart.items or cart.subtotal that are never populated.
type ReorderCart = { id: string; currency_code: string };

type ReorderResult =
  | { cart: ReorderCart }
  | { error: string; error_code: "item_unavailable" | "unknown_error" };

function classifyError(e: unknown): {
  error: string;
  error_code: "item_unavailable" | "unknown_error";
} {
  const msg = e instanceof Error ? e.message.toLowerCase() : "";
  if (
    msg.includes("variant") ||
    msg.includes("inventory") ||
    msg.includes("stock")
    // "not found" intentionally excluded: the backend returns NOT_FOUND for
    // both missing orders and IDOR violations, so matching it here would show
    // "items unavailable" for an auth/permissions error, which is wrong UX.
  ) {
    return {
      error: "Some items from this order are no longer available.",
      error_code: "item_unavailable",
    };
  }
  return {
    error: "Something went wrong. Please try again.",
    error_code: "unknown_error",
  };
}

export async function reorder(orderId: string): Promise<ReorderResult> {
  // Order IDs are system-generated ULIDs (e.g. order_01JNBA2VQ...) — never
  // typed by a user — so they must NOT be lowercased, unlike email addresses
  // which are normalized at the auth boundary.
  if (!/^order_[a-zA-Z0-9]+$/.test(orderId)) {
    return {
      error: "Something went wrong. Please try again.",
      error_code: "unknown_error",
    };
  }
  try {
    const headers = await getAuthHeaders();
    const { cart } = await sdk.client.fetch<{ cart: ReorderCart }>(
      `/store/customers/me/orders/${orderId}/reorder`,
      { method: "POST", headers },
    );
    try {
      await setCartId(cart.id);
    } finally {
      // Revalidate in finally so cache is always cleared even if setCartId throws.
      revalidateTag(TAGS.cart, "max");
      revalidatePath("/", "layout");
    }
    return { cart };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { order_id: orderId, action: "reorder" },
    });
    return classifyError(e);
  }
}
