import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review";
import type ProductReviewModuleService from "../../modules/product-review/service";

export type CreateReviewImagesStepInput = {
  review_id: string;
  images: { url: string; sort_order: number }[];
};

const MAX_REVIEW_IMAGES = 3;

export const createReviewImagesStep = createStep(
  "create-review-images",
  async (input: CreateReviewImagesStepInput, { container }) => {
    if (input.images.length > MAX_REVIEW_IMAGES) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Maximum ${MAX_REVIEW_IMAGES} images per review`,
      );
    }

    if (input.images.length === 0) {
      return new StepResponse([], []);
    }

    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE,
    );

    const created = await service.createReviewImages(
      input.images.map((img) => ({
        url: img.url,
        sort_order: img.sort_order,
        review_id: input.review_id,
      })),
    );

    const ids = created.map((c) => c.id);

    return new StepResponse(created, ids);
  },
  async (imageIds, { container }) => {
    if (!imageIds || imageIds.length === 0) return;

    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE,
    );

    await service.softDeleteReviewImages(imageIds);
  },
);
