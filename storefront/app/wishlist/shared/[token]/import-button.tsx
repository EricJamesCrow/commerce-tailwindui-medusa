"use client";

import { useTransition } from "react";
import { useNotification } from "components/notifications";
import { importWishlist } from "lib/medusa/wishlist";
import { HeartIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

export function ImportButton({ shareToken }: { shareToken: string }) {
  const [isPending, startTransition] = useTransition();
  const { showNotification } = useNotification();

  function handleImport() {
    startTransition(async () => {
      const result = await importWishlist(shareToken);
      if (result?.error) {
        showNotification("error", "Could not import wishlist", result.error);
      } else {
        showNotification(
          "success",
          "Wishlist imported!",
          "The items have been added to your account.",
        );
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleImport}
      disabled={isPending}
      className={clsx(
        "bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2",
        isPending && "cursor-not-allowed opacity-50",
      )}
    >
      <HeartIcon className="-ml-0.5 size-5" />
      {isPending ? "Importing..." : "Import to My Wishlist"}
    </button>
  );
}
