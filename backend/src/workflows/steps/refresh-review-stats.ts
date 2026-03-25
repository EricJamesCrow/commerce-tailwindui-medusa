import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review";
import ProductReviewModuleService from "../../modules/product-review/service";

export type RefreshReviewStatsStepInput = {
  product_id: string;
};

export const refreshReviewStatsStep = createStep(
  "refresh-review-stats",
  async (input: RefreshReviewStatsStepInput, { container }) => {
    const reviewModuleService: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE,
    );

    await reviewModuleService.refreshProductReviewStats(input.product_id);

    return new StepResponse(undefined);
  },
);

export const refreshReviewStatsForReviewsStep = createStep(
  "refresh-review-stats-for-reviews",
  async (reviews: { product_id: string }[], { container }) => {
    const reviewModuleService: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE,
    );

    const uniqueProductIds = [...new Set(reviews.map((r) => r.product_id))];

    for (const productId of uniqueProductIds) {
      await reviewModuleService.refreshProductReviewStats(productId);
    }

    return new StepResponse(undefined);
  },
);
