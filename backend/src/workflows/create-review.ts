import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import {
  createReviewStep,
  type CreateReviewStepInput,
} from "./steps/create-review";
import { createReviewImagesStep } from "./steps/create-review-images";
import { refreshReviewStatsStep } from "./steps/refresh-review-stats";
import { useQueryGraphStep, emitEventStep } from "@medusajs/medusa/core-flows";

export const createReviewWorkflow = createWorkflow(
  "create-review",
  function (input: CreateReviewStepInput) {
    // Validate product exists — explicit check instead of throwIfKeyNotFound
    // which can produce misleading errors (see GitHub #11550)
    const productQuery = useQueryGraphStep({
      entity: "product",
      fields: ["id"],
      filters: {
        id: input.product_id,
      },
    });

    transform({ productQuery }, ({ productQuery: result }) => {
      if (!result?.data?.length) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found");
      }
    });

    const review = createReviewStep(input);

    const imagesInput = transform({ review, input }, (data) => ({
      review_id: data.review.id,
      images: data.input.images || [],
    }));

    when({ imagesInput }, (data) => data.imagesInput.images.length > 0).then(
      function () {
        createReviewImagesStep(imagesInput);
      },
    );

    const statsInput = transform({ input }, (data) => ({
      product_id: data.input.product_id,
    }));

    refreshReviewStatsStep(statsInput);

    const eventData = transform({ review, input }, (data) => ({
      eventName: "product_review.created" as const,
      data: {
        id: data.review.id,
        product_id: data.input.product_id,
      },
    }));

    emitEventStep(eventData);

    return new WorkflowResponse({
      review,
    });
  },
);
