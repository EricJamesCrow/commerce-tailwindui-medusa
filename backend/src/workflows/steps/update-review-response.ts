import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review";
import type ProductReviewModuleService from "../../modules/product-review/service";

export type UpdateReviewResponseStepInput = {
  id: string;
  content: string;
};

export const updateReviewResponseStep = createStep(
  "update-review-response",
  async (input: UpdateReviewResponseStepInput, { container }) => {
    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE,
    );

    const original = await service.retrieveReviewResponse(input.id);

    const updated = await service.updateReviewResponses({
      id: input.id,
      content: input.content,
    });

    return new StepResponse(updated, {
      id: original.id,
      content: original.content,
    });
  },
  async (originalData, { container }) => {
    if (!originalData) return;

    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE,
    );

    await service.updateReviewResponses({
      id: originalData.id,
      content: originalData.content,
    });
  },
);
