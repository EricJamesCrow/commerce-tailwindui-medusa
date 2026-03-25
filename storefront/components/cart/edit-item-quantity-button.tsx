"use client";

import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { updateItemQuantity } from "components/cart/actions";
import type { CartItem } from "lib/types";
import { useActionState } from "react";

function SubmitButton({
  type,
  size = "md",
}: {
  type: "plus" | "minus";
  size?: "xs" | "sm" | "md";
}) {
  return (
    <button
      type="submit"
      aria-label={
        type === "plus" ? "Increase item quantity" : "Reduce item quantity"
      }
      className={clsx(
        "ease focus-visible:outline-primary-600 flex h-full flex-none items-center justify-center rounded-full transition-all duration-200 hover:border-neutral-800 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2",
        size === "xs"
          ? "max-w-[28px] min-w-[28px] p-1"
          : size === "sm"
            ? "max-w-[32px] min-w-[32px] p-1.5"
            : "max-w-[36px] min-w-[36px] p-2",
      )}
    >
      {type === "plus" ? (
        <PlusIcon
          className={clsx(
            size === "xs"
              ? "h-3 w-3"
              : size === "sm"
                ? "h-3.5 w-3.5"
                : "h-4 w-4",
            "dark:text-neutral-500",
          )}
        />
      ) : (
        <MinusIcon
          className={clsx(
            size === "xs"
              ? "h-3 w-3"
              : size === "sm"
                ? "h-3.5 w-3.5"
                : "h-4 w-4",
            "dark:text-neutral-500",
          )}
        />
      )}
    </button>
  );
}

export function EditItemQuantityButton({
  item,
  type,
  optimisticUpdate,
  size = "md",
}: {
  item: CartItem;
  type: "plus" | "minus";
  optimisticUpdate: (
    merchandiseId: string,
    updateType: "plus" | "minus" | "delete",
  ) => void;
  size?: "xs" | "sm" | "md";
}) {
  const [message, formAction] = useActionState(updateItemQuantity, null);
  const payload = {
    merchandiseId: item.merchandise.id,
    quantity: type === "plus" ? item.quantity + 1 : item.quantity - 1,
  };
  const updateItemQuantityAction = formAction.bind(null, payload);

  return (
    <form
      action={async () => {
        optimisticUpdate(payload.merchandiseId, type);
        updateItemQuantityAction();
      }}
    >
      <SubmitButton type={type} size={size} />
      <p aria-live="polite" className="sr-only" role="status">
        {message}
      </p>
    </form>
  );
}
