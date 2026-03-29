import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { QueryContext } from "@medusajs/framework/utils";
import { syncProductsStep, SyncProductsStepInput } from "./steps/sync-products";
import { deleteProductsFromMeilisearchStep } from "./steps/delete-products-from-meilisearch";

type SyncProductsWorkflowInput = {
  filters?: Record<string, unknown>;
};

type QueriedCalculatedPrice = {
  calculated_amount?: number | null;
  currency_code?: string | null;
};

type QueriedVariant = {
  calculated_price?: QueriedCalculatedPrice | null;
  inventory_quantity?: number | null;
  manage_inventory?: boolean | null;
};

const preferredRegionId = process.env.NEXT_PUBLIC_DEFAULT_REGION_ID;
const pricingContext = {
  variants: {
    calculated_price: QueryContext(
      preferredRegionId
        ? { region_id: preferredRegionId }
        : { currency_code: "usd" },
    ),
  },
};

export const syncProductsWorkflow = createWorkflow(
  "sync-products-to-meilisearch",
  ({ filters }: SyncProductsWorkflowInput) => {
    const { data: products } = useQueryGraphStep({
      entity: "product",
      fields: [
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
      ],
      context: pricingContext,
      filters: filters || {},
    }).config({ name: "query-products-for-meilisearch" });

    const { publishedProducts, unpublishedIds } = transform(
      { products },
      (data) => {
        const publishedProducts: SyncProductsStepInput["products"] = [];
        const unpublishedIds: string[] = [];

        for (const product of data.products) {
          if (product.status === "published") {
            const variants = (product.variants || []) as QueriedVariant[];
            const collection_titles: string[] = [];
            const collection_handles: string[] = [];
            if (product.collection?.title) {
              collection_titles.push(product.collection.title);
            }
            if (product.collection?.handle) {
              collection_handles.push(product.collection.handle);
            }

            const tag_values = (product.tags || [])
              .map((t: { value?: string }) => t.value)
              .filter(Boolean) as string[];

            const variant_prices: number[] = [];
            for (const variant of variants) {
              const amount = variant.calculated_price?.calculated_amount;
              if (typeof amount === "number") {
                variant_prices.push(amount);
              }
            }

            const availability = variants.some(
              (v) => !v.manage_inventory || (v.inventory_quantity ?? 0) > 0,
            );
            const minVariantPrice = variant_prices.length
              ? Math.min(...variant_prices)
              : 0;
            const maxVariantPrice = variant_prices.length
              ? Math.max(...variant_prices)
              : 0;

            publishedProducts.push({
              id: product.id,
              title: product.title,
              description: product.description ?? null,
              handle: product.handle,
              thumbnail: product.thumbnail ?? null,
              collection_titles,
              collection_handles,
              tag_values,
              variant_prices,
              min_variant_price: minVariantPrice,
              max_variant_price: maxVariantPrice,
              availability,
              created_at: product.created_at,
              updated_at: product.updated_at,
            });
          } else {
            unpublishedIds.push(product.id);
          }
        }

        return { publishedProducts, unpublishedIds };
      },
    );

    syncProductsStep({ products: publishedProducts });
    deleteProductsFromMeilisearchStep({ ids: unpublishedIds });

    return new WorkflowResponse({ products });
  },
);
