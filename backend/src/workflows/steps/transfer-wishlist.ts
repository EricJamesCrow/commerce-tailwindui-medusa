import { MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { WISHLIST_MODULE } from "../../modules/wishlist";
import WishlistModuleService from "../../modules/wishlist/service";

type Input = {
  wishlist_id: string;
  customer_id: string;
};

export const transferWishlistStep = createStep(
  "transfer-wishlist",
  async ({ wishlist_id, customer_id }: Input, { container }) => {
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE);
    const wishlist = await wishlistService.retrieveWishlist(wishlist_id);

    if (wishlist.customer_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This wishlist is already assigned to a customer",
      );
    }

    await wishlistService.updateWishlists({ id: wishlist_id, customer_id });
    const updated = await wishlistService.retrieveWishlist(wishlist_id);
    return new StepResponse(updated, wishlist_id);
  },
  async (wishlistId, { container }) => {
    if (!wishlistId) return;
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE);
    await wishlistService.updateWishlists({
      id: wishlistId,
      customer_id: null as any,
    });
  },
);
