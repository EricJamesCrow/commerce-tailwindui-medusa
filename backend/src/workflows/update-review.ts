import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  updateReviewsStep,
  type UpdateReviewsStepInput,
} from "./steps/update-review";
import { refreshReviewStatsForReviewsStep } from "./steps/refresh-review-stats";
import { emitEventStep } from "@medusajs/medusa/core-flows";

export const updateReviewWorkflow = createWorkflow(
  "update-review",
  function (input: UpdateReviewsStepInput) {
    const reviews = updateReviewsStep(input);

    refreshReviewStatsForReviewsStep(reviews);

    const eventData = transform({ reviews }, (data) => ({
      eventName: "product_review.updated" as const,
      data: {
        ids: data.reviews.map((r: { id: string }) => r.id),
      },
    }));

    emitEventStep(eventData);

    return new WorkflowResponse({
      reviews,
    });
  },
);
