import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { validateWishlistExistsStep } from "./steps/validate-wishlist-exists";
import { validateWishlistSalesChannelStep } from "./steps/validate-wishlist-sales-channel";
import { validateVariantWishlistStep } from "./steps/validate-variant-wishlist";
import { createWishlistItemStep } from "./steps/create-wishlist-item";

type CreateWishlistItemWorkflowInput = {
  variant_id: string;
  wishlist_id: string;
  sales_channel_id: string;
};

export const createWishlistItemWorkflow = createWorkflow(
  "create-wishlist-item",
  (input: CreateWishlistItemWorkflowInput) => {
    const { data: wishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*", "items.*"],
      filters: { id: input.wishlist_id },
    });

    validateWishlistExistsStep({ wishlists });

    const salesChannelInput = transform({ wishlists, input }, (data) => ({
      wishlist_sales_channel_id: data.wishlists[0]!.sales_channel_id,
      sales_channel_id: data.input.sales_channel_id,
    }));

    validateWishlistSalesChannelStep(salesChannelInput);

    const variantInput = transform({ wishlists, input }, (data) => ({
      variant_id: data.input.variant_id,
      sales_channel_id: data.input.sales_channel_id,
      wishlist_items: (data.wishlists[0]!.items ?? []) as {
        product_variant_id: string;
      }[],
    }));

    validateVariantWishlistStep(variantInput);

    const itemInput = transform({ wishlists, input }, (data) => ({
      product_variant_id: data.input.variant_id,
      wishlist_id: data.wishlists[0]!.id,
    }));

    createWishlistItemStep(itemInput);

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
