"use server";

const REORDER_DISABLED_MESSAGE =
  "Reordering is temporarily unavailable while checkout is being hardened.";

type ReorderResult = { error: string; error_code: "temporarily_unavailable" };

export async function reorder(orderId: string): Promise<ReorderResult> {
  // Keep the action stable for stale clients, but do not mutate carts while the
  // checkout payment flow is being hardened.
  void orderId;
  return {
    error: REORDER_DISABLED_MESSAGE,
    error_code: "temporarily_unavailable",
  };
}
