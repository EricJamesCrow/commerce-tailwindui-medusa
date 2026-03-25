import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { trackAnalyticsEventStep } from "../steps/track-analytics-event";

type TrackPaymentRefundedInput = {
  payment_id: string;
};

export const trackPaymentRefundedWorkflow = createWorkflow(
  "track-payment-refunded",
  function (input: TrackPaymentRefundedInput) {
    // Fetch payment with its collection's order link
    const { data: payments } = useQueryGraphStep({
      entity: "payment",
      fields: [
        "id",
        "amount",
        "currency_code",
        "payment_collection.order.id",
        "payment_collection.order.customer_id",
        "payment_collection.order.email",
      ],
      filters: { id: input.payment_id },
    });

    const trackingInput = transform({ payments }, ({ payments: result }) => {
      // Cast: Medusa WorkflowData union too complex for nested step result types
      const payment = result[0] as Record<string, any> | undefined;
      if (!payment) return null;

      const order = payment.payment_collection?.order;
      return {
        event: "payment_refunded",
        actor_id: order?.customer_id ?? null,
        actor_fallback: order?.email ?? null,
        properties: {
          payment_id: payment.id,
          order_id: order?.id ?? null,
          amount: payment.amount,
          currency_code: payment.currency_code,
        },
      };
    });

    trackAnalyticsEventStep(trackingInput);

    return new WorkflowResponse({});
  },
);
