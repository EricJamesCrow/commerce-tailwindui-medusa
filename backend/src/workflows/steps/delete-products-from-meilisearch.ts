import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MEILISEARCH_MODULE } from "../../modules/meilisearch";
import MeilisearchModuleService from "../../modules/meilisearch/service";

export type DeleteProductsStepInput = {
  ids: string[];
};

export const deleteProductsFromMeilisearchStep = createStep(
  "delete-products-from-meilisearch",
  async ({ ids }: DeleteProductsStepInput, { container }) => {
    if (ids.length === 0) return new StepResponse(undefined, { deleted: [] });

    const meilisearchService =
      container.resolve<MeilisearchModuleService>(MEILISEARCH_MODULE);

    await meilisearchService.deleteFromIndex(ids);

    return new StepResponse(undefined, { deleted: ids });
  },
);
