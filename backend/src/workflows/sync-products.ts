import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { syncProductsStep, SyncProductsStepInput } from "./steps/sync-products";
import { deleteProductsFromMeilisearchStep } from "./steps/delete-products-from-meilisearch";

type SyncProductsWorkflowInput = {
  filters?: Record<string, unknown>;
};

type QueriedPrice = {
  amount?: number | null;
  currency_code?: string | null;
};

type QueriedVariant = {
  prices?: QueriedPrice[] | null;
  inventory_quantity?: number | null;
  manage_inventory?: boolean | null;
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
        "tags.value",
        "variants.prices.*",
        "variants.inventory_quantity",
        "variants.manage_inventory",
      ],
      filters: filters || {},
    });

    const { publishedProducts, unpublishedIds } = transform(
      { products },
      (data) => {
        const publishedProducts: SyncProductsStepInput["products"] = [];
        const unpublishedIds: string[] = [];

        for (const product of data.products) {
          if (product.status === "published") {
            const variants = (product.variants || []) as QueriedVariant[];
            const collection_titles: string[] = [];
            if (product.collection?.title) {
              collection_titles.push(product.collection.title);
            }

            const tag_values = (product.tags || [])
              .map((t: { value?: string }) => t.value)
              .filter(Boolean) as string[];

            // Only index USD prices (default store currency) to avoid
            // leaking internal pricing from other regions/price lists
            const variant_prices: number[] = [];
            for (const variant of variants) {
              for (const price of variant.prices || []) {
                if (
                  typeof price.amount === "number" &&
                  price.currency_code === "usd"
                ) {
                  variant_prices.push(price.amount);
                }
              }
            }

            const availability = variants.some(
              (v) => !v.manage_inventory || (v.inventory_quantity ?? 0) > 0,
            );

            publishedProducts.push({
              id: product.id,
              title: product.title,
              description: product.description ?? null,
              handle: product.handle,
              thumbnail: product.thumbnail ?? null,
              collection_titles,
              tag_values,
              variant_prices,
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
