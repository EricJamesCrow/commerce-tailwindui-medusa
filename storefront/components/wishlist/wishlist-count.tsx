"use client";

import { HeartIcon } from "@heroicons/react/20/solid";
import { useEffect, useState } from "react";
import { getProductWishlistCount } from "lib/medusa/wishlist";
import * as Sentry from "@sentry/nextjs";

export function WishlistCount({ productId }: { productId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    getProductWishlistCount(productId)
      .then(setCount)
      .catch((e: unknown) => {
        Sentry.captureException(e, {
          tags: { action: "get_product_wishlist_count" },
          level: "info",
        });
      });
  }, [productId]);

  if (count === 0) return null;

  return (
    <p className="mt-2 flex items-center gap-1 text-sm text-gray-500">
      <HeartIcon className="size-4 text-red-400" />
      {count} {count === 1 ? "person" : "people"} saved this
    </p>
  );
}
