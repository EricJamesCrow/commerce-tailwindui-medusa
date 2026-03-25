"use client";

import { removeItem } from "components/cart/actions";
import { useActionState } from "react";

export function RemoveItemButton({ lineItemId }: { lineItemId: string }) {
  const [message, formAction, isPending] = useActionState(removeItem, null);

  return (
    <form action={() => formAction(lineItemId)}>
      <button
        type="submit"
        disabled={isPending}
        className="text-primary-600 hover:text-primary-500 font-medium"
      >
        {isPending ? "Removing..." : "Remove"}
      </button>
      {message && (
        <p
          role="status"
          aria-live="polite"
          className="mt-1 text-xs text-red-600"
        >
          {message}
        </p>
      )}
    </form>
  );
}
