import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { trackAnalyticsEventStep } from "../steps/track-analytics-event";

type TrackOrderPlacedInput = {
  order_id: string;
};

export const trackOrderPlacedWorkflow = createWorkflow(
  "track-order-placed",
  function (input: TrackOrderPlacedInput) {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "customer_id",
        "email",
        "total",
        "currency_code",
        "items.id",
        "cart_id",
      ],
      filters: { id: input.order_id },
    });

    // Fetch cart to check abandoned_cart_notified metadata (only if cart_id exists)
    const cartQueryInput = transform({ orders }, (d) => {
      // Cast: Medusa WorkflowData union too complex for nested step result types
      const cartId = (d.orders[0] as Record<string, any>)?.cart_id;
      if (!cartId)
        return {
          entity: "cart" as const,
          fields: ["id", "metadata"],
          filters: { id: "nonexistent" },
        };
      return {
        entity: "cart" as const,
        fields: ["id", "metadata"],
        filters: { id: cartId },
      };
    });

    const { data: carts } = useQueryGraphStep(cartQueryInput).config({
      name: "fetch-cart-for-recovery-check",
    });

    const trackingInput = transform(
      { orders, carts },
      ({ orders: orderResult, carts: cartResult }) => {
        const order = orderResult[0];
        if (!order) return null;

        // Cast: Medusa WorkflowData union too complex for nested step result types
        const cart = cartResult[0] as Record<string, any> | undefined;
        // abandoned_cart_notified stores an ISO date string, not a boolean
        const isRecoveredCart = Boolean(
          cart?.metadata?.abandoned_cart_notified,
        );

        return {
          event: "order_placed",
          actor_id: order.customer_id ?? null,
          actor_fallback: order.email ?? null,
          properties: {
            order_id: order.id,
            total: order.total,
            item_count: order.items?.length ?? 0,
            currency_code: order.currency_code,
            customer_id: order.customer_id ?? null,
            is_recovered_cart: isRecoveredCart,
          },
        };
      },
    );

    trackAnalyticsEventStep(trackingInput);

    return new WorkflowResponse({});
  },
);
