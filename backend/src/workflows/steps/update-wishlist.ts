import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { WISHLIST_MODULE } from "../../modules/wishlist";
import WishlistModuleService from "../../modules/wishlist/service";

type Input = {
  wishlist_id: string;
  name?: string;
};

export const updateWishlistStep = createStep(
  "update-wishlist",
  async ({ wishlist_id, ...data }: Input, { container }) => {
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE);
    const [existing] = await wishlistService.listWishlists({ id: wishlist_id });
    const previousName = existing?.name;
    await wishlistService.updateWishlists({ id: wishlist_id, ...data });
    const updated = await wishlistService.retrieveWishlist(wishlist_id);
    return new StepResponse(updated, { wishlist_id, name: previousName });
  },
  async (compensationData, { container }) => {
    if (!compensationData) return;
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE);
    await wishlistService.updateWishlists({
      id: compensationData.wishlist_id,
      name: compensationData.name,
    });
  },
);
