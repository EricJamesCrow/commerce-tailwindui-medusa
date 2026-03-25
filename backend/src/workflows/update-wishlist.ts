import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { validateWishlistExistsStep } from "./steps/validate-wishlist-exists";
import { updateWishlistStep } from "./steps/update-wishlist";

type UpdateWishlistWorkflowInput = {
  wishlist_id: string;
  customer_id: string;
  name?: string;
};

export const updateWishlistWorkflow = createWorkflow(
  "update-wishlist",
  (input: UpdateWishlistWorkflowInput) => {
    const { data: wishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*"],
      filters: { id: input.wishlist_id, customer_id: input.customer_id },
    });

    validateWishlistExistsStep({ wishlists });

    const wishlist = updateWishlistStep({
      wishlist_id: input.wishlist_id,
      name: input.name,
    });

    return new WorkflowResponse({ wishlist });
  },
);
