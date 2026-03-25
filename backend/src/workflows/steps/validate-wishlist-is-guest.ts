import { MedusaError } from "@medusajs/framework/utils";
import { createStep } from "@medusajs/framework/workflows-sdk";

type Input = {
  wishlists?: { id: string; customer_id?: string | null }[];
};

export const validateWishlistIsGuestStep = createStep(
  "validate-wishlist-is-guest",
  async (input: Input) => {
    const wishlist = input.wishlists?.[0];
    if (wishlist?.customer_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Cannot transfer a wishlist that already belongs to a customer",
      );
    }
  },
);
