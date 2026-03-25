import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { emitEventStep } from "@medusajs/medusa/core-flows";
import { deleteReviewResponseStep } from "./steps/delete-review-response";

type DeleteReviewResponseInput = {
  id: string;
};

export const deleteReviewResponseWorkflow = createWorkflow(
  "delete-review-response",
  function (input: DeleteReviewResponseInput) {
    deleteReviewResponseStep(input.id);

    const eventData = transform({ input }, (data) => ({
      eventName: "product_review_response.deleted" as const,
      data: { id: data.input.id },
    }));

    emitEventStep(eventData);

    return new WorkflowResponse({ success: true });
  },
);
