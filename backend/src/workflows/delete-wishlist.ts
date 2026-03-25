import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { validateWishlistExistsStep } from "./steps/validate-wishlist-exists";
import { deleteWishlistStep } from "./steps/delete-wishlist";

type DeleteWishlistWorkflowInput = {
  wishlist_id: string;
  customer_id: string;
};

export const deleteWishlistWorkflow = createWorkflow(
  "delete-wishlist",
  (input: DeleteWishlistWorkflowInput) => {
    const { data: wishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*"],
      filters: { id: input.wishlist_id, customer_id: input.customer_id },
    });

    validateWishlistExistsStep({ wishlists });

    deleteWishlistStep({ wishlist_id: input.wishlist_id });

    return new WorkflowResponse({ success: true });
  },
);
