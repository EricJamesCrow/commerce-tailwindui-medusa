"use client";

import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { useEffect, useState, useTransition } from "react";
import {
  addToWishlist,
  removeFromWishlist,
  getVariantWishlistState,
  type WishlistActionResult,
} from "lib/medusa/wishlist";
import { useNotification } from "components/notifications";
import clsx from "clsx";

type WishlistButtonProps = {
  variantId: string;
  productId?: string;
  isInWishlist?: boolean;
  wishlistId?: string;
  wishlistItemId?: string;
  size?: "sm" | "md";
  className?: string;
};

export function WishlistButton({
  variantId,
  productId,
  isInWishlist: initialIsInWishlist,
  wishlistId: initialWishlistId,
  wishlistItemId: initialWishlistItemId,
  size = "md",
  className,
}: WishlistButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(initialIsInWishlist ?? false);
  const [wishlistId, setWishlistId] = useState(initialWishlistId);
  const [wishlistItemId, setWishlistItemId] = useState(initialWishlistItemId);
  const [isPending, startTransition] = useTransition();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (initialIsInWishlist !== undefined) {
      setIsWishlisted(initialIsInWishlist);
      setWishlistId(initialWishlistId);
      setWishlistItemId(initialWishlistItemId);
      return;
    }

    // Auto-check wishlist state when not provided by server
    let cancelled = false;
    getVariantWishlistState(variantId).then((state) => {
      if (cancelled) return;
      setIsWishlisted(state.isInWishlist);
      setWishlistId(state.wishlistId);
      setWishlistItemId(state.wishlistItemId);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [variantId, initialIsInWishlist, initialWishlistId, initialWishlistItemId]);

  function handleClick() {
    startTransition(async () => {
      if (isWishlisted && wishlistId && wishlistItemId) {
        const formData = new FormData();
        formData.set("wishlist_id", wishlistId);
        formData.set("item_id", wishlistItemId);
        if (productId) formData.set("product_id", productId);
        formData.set("variant_id", variantId);
        const result = await removeFromWishlist(null, formData);
        if (result?.error) {
          showNotification("error", "Could not remove from wishlist", result.error);
        } else {
          setIsWishlisted(false);
          setWishlistId(undefined);
          setWishlistItemId(undefined);
          showNotification("success", "Removed from wishlist");
        }
      } else {
        const formData = new FormData();
        formData.set("variant_id", variantId);
        if (productId) formData.set("product_id", productId);
        if (wishlistId) formData.set("wishlist_id", wishlistId);
        const result = await addToWishlist(null, formData);
        if (result?.error) {
          showNotification("error", "Could not add to wishlist", result.error);
        } else {
          setIsWishlisted(true);
          // Refresh state to get the new wishlistId and itemId
          const newState = await getVariantWishlistState(variantId);
          setWishlistId(newState.wishlistId);
          setWishlistItemId(newState.wishlistItemId);
          showNotification("success", "Added to wishlist");
        }
      }
    });
  }

  const iconSize = size === "sm" ? "size-5" : "size-6";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={clsx(
        "group/heart rounded-full p-2 transition-colors",
        isWishlisted
          ? "text-red-500 hover:text-red-600"
          : "text-gray-400 hover:text-red-500",
        isPending && "opacity-50",
        className,
      )}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      {isWishlisted ? (
        <HeartSolid className={clsx(iconSize, isPending && "animate-pulse")} />
      ) : (
        <HeartOutline className={clsx(iconSize, "group-hover/heart:fill-red-100")} />
      )}
    </button>
  );
}
