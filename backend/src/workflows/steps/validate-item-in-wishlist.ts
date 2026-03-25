import { MedusaError } from "@medusajs/framework/utils";
import { createStep } from "@medusajs/framework/workflows-sdk";

type Input = {
  wishlist_items: { id: string }[];
  wishlist_item_id: string;
};

export const validateItemInWishlistStep = createStep(
  "validate-item-in-wishlist",
  async ({ wishlist_items, wishlist_item_id }: Input) => {
    const item = wishlist_items.find((item) => item.id === wishlist_item_id);
    if (!item) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Item does not exist in this wishlist",
      );
    }
  },
);
