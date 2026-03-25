import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { WISHLIST_MODULE } from "../../modules/wishlist";
import WishlistModuleService from "../../modules/wishlist/service";

type Input = { wishlist_id: string };

export const deleteWishlistStep = createStep(
  "delete-wishlist",
  async ({ wishlist_id }: Input, { container }) => {
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE);
    await wishlistService.softDeleteWishlists(wishlist_id);
    return new StepResponse(void 0, wishlist_id);
  },
  async (wishlistId, { container }) => {
    if (!wishlistId) return;
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE);
    await wishlistService.restoreWishlists([wishlistId]);
  },
);
