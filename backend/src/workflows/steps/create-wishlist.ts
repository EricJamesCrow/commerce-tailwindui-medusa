import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { WISHLIST_MODULE } from "../../modules/wishlist";
import WishlistModuleService from "../../modules/wishlist/service";

export type CreateWishlistStepInput = {
  customer_id?: string;
  sales_channel_id: string;
  name?: string;
};

export const createWishlistStep = createStep(
  "create-wishlist",
  async (input: CreateWishlistStepInput, { container }) => {
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE);
    const wishlist = await wishlistService.createWishlists(input);
    return new StepResponse(wishlist, wishlist.id);
  },
  async (id, { container }) => {
    if (!id) return;
    const wishlistService: WishlistModuleService =
      container.resolve(WISHLIST_MODULE);
    await wishlistService.deleteWishlists(id);
  },
);
