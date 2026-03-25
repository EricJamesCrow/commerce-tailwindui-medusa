import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep, emitEventStep } from "@medusajs/medusa/core-flows";
import { validateWishlistExistsStep } from "./steps/validate-wishlist-exists";
import { validateWishlistIsGuestStep } from "./steps/validate-wishlist-is-guest";
import { validateWishlistSalesChannelStep } from "./steps/validate-wishlist-sales-channel";
import { transferWishlistStep } from "./steps/transfer-wishlist";

type TransferWishlistWorkflowInput = {
  wishlist_id: string;
  customer_id: string;
  sales_channel_id: string;
};

export const transferWishlistWorkflow = createWorkflow(
  "transfer-wishlist",
  (input: TransferWishlistWorkflowInput) => {
    const { data: wishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*"],
      filters: { id: input.wishlist_id },
    });

    validateWishlistExistsStep({ wishlists });
    validateWishlistIsGuestStep({ wishlists });

    const salesChannelInput = transform({ wishlists, input }, (data) => ({
      wishlist_sales_channel_id: data.wishlists[0]!.sales_channel_id,
      sales_channel_id: data.input.sales_channel_id,
    }));

    validateWishlistSalesChannelStep(salesChannelInput);

    const wishlist = transferWishlistStep({
      wishlist_id: input.wishlist_id,
      customer_id: input.customer_id,
    });

    const eventData = transform({ wishlist, input }, (data) => ({
      eventName: "wishlist.transferred" as const,
      data: {
        id: data.wishlist.id,
        customer_id: data.input.customer_id,
      },
    }));

    emitEventStep(eventData);

    return new WorkflowResponse({ wishlist });
  },
);
