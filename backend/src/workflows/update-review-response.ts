import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { emitEventStep } from "@medusajs/medusa/core-flows";
import {
  updateReviewResponseStep,
  type UpdateReviewResponseStepInput,
} from "./steps/update-review-response";

export const updateReviewResponseWorkflow = createWorkflow(
  "update-review-response",
  function (input: UpdateReviewResponseStepInput) {
    const response = updateReviewResponseStep(input);

    const eventData = transform({ response }, (data) => ({
      eventName: "product_review_response.updated" as const,
      data: { id: data.response.id },
    }));

    emitEventStep(eventData);

    return new WorkflowResponse({ response });
  },
);
