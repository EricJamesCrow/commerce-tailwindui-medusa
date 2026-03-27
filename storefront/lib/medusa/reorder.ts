"use server";

import { sdk } from "lib/medusa";
import { TAGS } from "lib/constants";
import type { HttpTypes } from "@medusajs/types";
import { setCartId, getAuthHeaders } from "lib/medusa/cookies";
import * as Sentry from "@sentry/nextjs";
import { revalidatePath, revalidateTag } from "next/cache";

type ReorderResult =
  | { cart: HttpTypes.StoreCart }
  | { error: string; error_code: "item_unavailable" | "unknown_error" };

function classifyError(e: unknown): {
  error: string;
  error_code: "item_unavailable" | "unknown_error";
} {
  const msg = e instanceof Error ? e.message.toLowerCase() : "";
  if (
    msg.includes("variant") ||
    msg.includes("inventory") ||
    msg.includes("stock") ||
    msg.includes("not found")
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
  if (!/^order_[a-z0-9]+$/.test(orderId)) {
    return {
      error: "Something went wrong. Please try again.",
      error_code: "unknown_error",
    };
  }
  try {
    const headers = await getAuthHeaders();
    const { cart } = await sdk.client.fetch<{ cart: HttpTypes.StoreCart }>(
      `/store/customers/me/orders/${orderId}/reorder`,
      { method: "POST", headers },
    );
    await setCartId(cart.id);
    revalidateTag(TAGS.cart, "max");
    revalidatePath("/", "layout");
    return { cart };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { order_id: orderId, action: "reorder" },
    });
    return classifyError(e);
  }
}
