import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review";
import type ProductReviewModuleService from "../../modules/product-review/service";

export type CreateReviewResponseStepInput = {
  review_id: string;
  content: string;
};

export const createReviewResponseStep = createStep(
  "create-review-response",
  async (input: CreateReviewResponseStepInput, { container }) => {
    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE,
    );

    const response = await service.createReviewResponses({
      content: input.content,
      review_id: input.review_id,
    });

    return new StepResponse(response, response.id);
  },
  async (responseId, { container }) => {
    if (!responseId) return;

    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE,
    );

    await service.softDeleteReviewResponses(responseId);
  },
);
