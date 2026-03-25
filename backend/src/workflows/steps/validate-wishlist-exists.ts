import { MedusaError } from "@medusajs/framework/utils";
import { createStep } from "@medusajs/framework/workflows-sdk";

type Input = {
  wishlists?: { id: string }[];
};

export const validateWishlistExistsStep = createStep(
  "validate-wishlist-exists",
  async (input: Input) => {
    if (!input.wishlists?.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "No wishlist found");
    }
  },
);
