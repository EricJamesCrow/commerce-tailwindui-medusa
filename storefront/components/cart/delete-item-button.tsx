"use client";

import { removeItem } from "components/cart/actions";
import type { CartItem } from "lib/types";
import { useActionState } from "react";

export function DeleteItemButton({
  item,
  optimisticUpdate,
}: {
  item: CartItem;
  optimisticUpdate: (
    merchandiseId: string,
    updateType: "plus" | "minus" | "delete",
  ) => void;
}) {
  const [message, formAction] = useActionState(removeItem, null);
  const lineItemId = item.id ?? "";
  const merchandiseId = item.merchandise.id;
  const removeItemAction = formAction.bind(null, lineItemId);

  return (
    <form
      action={async () => {
        optimisticUpdate(merchandiseId, "delete");
        removeItemAction();
      }}
    >
      <button
        type="submit"
        aria-label="Remove cart item"
        className="text-primary-600 hover:text-primary-500 focus-visible:outline-primary-600 rounded font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Remove
      </button>
      <p aria-live="polite" className="sr-only" role="status">
        {message}
      </p>
    </form>
  );
}
