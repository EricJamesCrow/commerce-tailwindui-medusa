import { MedusaError } from "@medusajs/framework/utils";
import { createStep } from "@medusajs/framework/workflows-sdk";

type Input = {
  wishlist_sales_channel_id: string;
  sales_channel_id: string;
};

export const validateWishlistSalesChannelStep = createStep(
  "validate-wishlist-sales-channel",
  async ({ wishlist_sales_channel_id, sales_channel_id }: Input) => {
    if (wishlist_sales_channel_id !== sales_channel_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Wishlist does not belong to the current sales channel",
      );
    }
  },
);
