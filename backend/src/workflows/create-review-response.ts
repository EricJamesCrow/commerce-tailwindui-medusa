import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { emitEventStep } from "@medusajs/medusa/core-flows";
import {
  createReviewResponseStep,
  type CreateReviewResponseStepInput,
} from "./steps/create-review-response";

export const createReviewResponseWorkflow = createWorkflow(
  "create-review-response",
  function (input: CreateReviewResponseStepInput) {
    const response = createReviewResponseStep(input);

    const eventData = transform({ response }, (data) => ({
      eventName: "product_review_response.created" as const,
      data: { id: data.response.id },
    }));

    emitEventStep(eventData);

    return new WorkflowResponse({ response });
  },
);
