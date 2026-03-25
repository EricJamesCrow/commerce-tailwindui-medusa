import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { trackAnalyticsEventStep } from "../steps/track-analytics-event";

type TrackShipmentCreatedInput = {
  fulfillment_id: string;
};

export const trackShipmentCreatedWorkflow = createWorkflow(
  "track-shipment-created",
  function (input: TrackShipmentCreatedInput) {
    // Fetch fulfillment with its order link
    const { data: fulfillments } = useQueryGraphStep({
      entity: "fulfillment",
      fields: [
        "id",
        "items.id",
        "order.id",
        "order.customer_id",
        "order.email",
      ],
      filters: { id: input.fulfillment_id },
    });

    const trackingInput = transform(
      { fulfillments },
      ({ fulfillments: result }) => {
        // Cast: Medusa WorkflowData union too complex for nested step result types
        const fulfillment = result[0] as Record<string, any> | undefined;
        if (!fulfillment) return null;

        const order = fulfillment.order;
        return {
          event: "shipment_created",
          actor_id: order?.customer_id ?? null,
          actor_fallback: order?.email ?? null,
          properties: {
            order_id: order?.id ?? null,
            fulfillment_id: fulfillment.id,
            item_count: fulfillment.items?.length ?? 0,
          },
        };
      },
    );

    trackAnalyticsEventStep(trackingInput);

    return new WorkflowResponse({});
  },
);
