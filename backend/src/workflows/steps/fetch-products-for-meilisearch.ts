import {
  ContainerRegistrationKeys,
  MedusaError,
  QueryContext,
} from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

export type FetchProductsForMeilisearchStepInput = {
  filters?: Record<string, unknown>;
  regionId?: string;
};

const PRODUCT_FIELDS = [
  "id",
  "title",
  "description",
  "handle",
  "thumbnail",
  "status",
  "created_at",
  "updated_at",
  "collection.title",
  "collection.handle",
  "tags.value",
  "variants.calculated_price.*",
  "variants.inventory_quantity",
  "variants.manage_inventory",
];

export const fetchProductsForMeilisearchStep = createStep(
  "fetch-products-for-meilisearch",
  async (
    { filters, regionId }: FetchProductsForMeilisearchStepInput,
    { container },
  ) => {
    const resolvedRegionId = regionId ?? process.env.MEILISEARCH_REGION_ID;

    if (!resolvedRegionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "MEILISEARCH_REGION_ID is required to sync calculated prices to Meilisearch.",
      );
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
      entity: "product",
      fields: PRODUCT_FIELDS,
      context: {
        variants: {
          calculated_price: QueryContext({ region_id: resolvedRegionId }),
        },
      },
      filters: filters || {},
    });

    return new StepResponse(data);
  },
);
