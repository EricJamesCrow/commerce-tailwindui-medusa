import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { WISHLIST_MODULE } from "../../modules/wishlist";
import WishlistModuleService from "../../modules/wishlist/service";

type Input = { wishlist_item_id: string };

export const deleteWishlistItemStep = createStep(
  "delete-wishlist-item",
  async ({ wishlist_item_id }: Input, { container }) => {
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE);
    await wishlistService.softDeleteWishlistItems(wishlist_item_id);
    return new StepResponse(void 0, wishlist_item_id);
  },
  async (wishlistItemId, { container }) => {
    if (!wishlistItemId) return;
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE);
    await wishlistService.restoreWishlistItems([wishlistItemId]);
  },
);
