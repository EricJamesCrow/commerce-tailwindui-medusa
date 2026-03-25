import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { trackAnalyticsEventStep } from "../steps/track-analytics-event";

type TrackCustomerCreatedInput = {
  customer_id: string;
};

export const trackCustomerCreatedWorkflow = createWorkflow(
  "track-customer-created",
  function (input: TrackCustomerCreatedInput) {
    const { data: customers } = useQueryGraphStep({
      entity: "customer",
      fields: ["id", "has_account"],
      filters: { id: input.customer_id },
    });

    const trackingInput = transform({ customers }, ({ customers: result }) => {
      const customer = result[0];
      if (!customer) return null;

      return {
        event: "customer_created",
        actor_id: customer.id,
        actor_fallback: null,
        properties: {
          customer_id: customer.id,
          has_account: customer.has_account ?? false,
        },
      };
    });

    trackAnalyticsEventStep(trackingInput);

    return new WorkflowResponse({});
  },
);
