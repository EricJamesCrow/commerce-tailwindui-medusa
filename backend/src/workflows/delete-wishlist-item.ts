import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { validateWishlistExistsStep } from "./steps/validate-wishlist-exists";
import { validateItemInWishlistStep } from "./steps/validate-item-in-wishlist";
import { deleteWishlistItemStep } from "./steps/delete-wishlist-item";

type DeleteWishlistItemWorkflowInput = {
  wishlist_item_id: string;
  wishlist_id: string;
};

export const deleteWishlistItemWorkflow = createWorkflow(
  "delete-wishlist-item",
  (input: DeleteWishlistItemWorkflowInput) => {
    const { data: wishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*", "items.*"],
      filters: { id: input.wishlist_id },
    });

    validateWishlistExistsStep({ wishlists });

    const validateInput = transform({ wishlists, input }, (data) => ({
      wishlist_items: (data.wishlists[0]!.items ?? []) as { id: string }[],
      wishlist_item_id: data.input.wishlist_item_id,
    }));

    validateItemInWishlistStep(validateInput);

    deleteWishlistItemStep({ wishlist_item_id: input.wishlist_item_id });

    const { data: updatedWishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*", "items.*", "items.product_variant.*"],
      filters: { id: input.wishlist_id },
    }).config({ name: "refetch-wishlist" });

    return new WorkflowResponse(
      transform({ updatedWishlists }, (data) => ({
        wishlist: data.updatedWishlists[0]!,
      })),
    );
  },
);
