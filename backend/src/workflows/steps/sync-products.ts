import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MEILISEARCH_MODULE } from "../../modules/meilisearch";
import MeilisearchModuleService from "../../modules/meilisearch/service";

export type SyncProductsStepInput = {
  products: {
    id: string;
    title: string;
    description?: string | null;
    handle: string;
    thumbnail?: string | null;
    collection_titles: string[];
    tag_values: string[];
    variant_prices: number[];
    availability: boolean;
    created_at: string | Date;
    updated_at: string | Date;
  }[];
};

export const syncProductsStep = createStep(
  "sync-products-to-meilisearch",
  async ({ products }: SyncProductsStepInput, { container }) => {
    if (products.length === 0)
      return new StepResponse(undefined, { indexed: [] });

    const meilisearchService =
      container.resolve<MeilisearchModuleService>(MEILISEARCH_MODULE);

    await meilisearchService.indexData(
      products as unknown as Record<string, unknown>[],
    );

    return new StepResponse(undefined, {
      indexed: products.map((p) => p.id),
    });
  },
);
