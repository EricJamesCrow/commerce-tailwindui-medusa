import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review";
import type ProductReviewModuleService from "../../modules/product-review/service";

export const deleteReviewResponseStep = createStep(
  "delete-review-response",
  async (id: string, { container }) => {
    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE,
    );

    const original = await service.retrieveReviewResponse(id);

    await service.softDeleteReviewResponses(id);

    return new StepResponse(undefined, original);
  },
  async (original, { container }) => {
    if (!original) return;

    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE,
    );

    await service.restoreReviewResponses(original.id);
  },
);
