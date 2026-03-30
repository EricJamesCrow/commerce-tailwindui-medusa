import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { syncProductsStep, SyncProductsStepInput } from "./steps/sync-products";
import { deleteProductsFromMeilisearchStep } from "./steps/delete-products-from-meilisearch";
import { fetchProductsForMeilisearchStep } from "./steps/fetch-products-for-meilisearch";

type SyncProductsWorkflowInput = {
  filters?: Record<string, unknown>;
  regionId?: string;
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

type QueriedProduct = {
  id: string;
  title: string;
  description?: string | null;
  handle: string;
  thumbnail?: string | null;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
  collection?: {
    title?: string | null;
    handle?: string | null;
  } | null;
  tags?: { value?: string | null }[] | null;
  variants?: QueriedVariant[] | null;
};

export const syncProductsWorkflow = createWorkflow(
  "sync-products-to-meilisearch",
  ({ filters, regionId }: SyncProductsWorkflowInput) => {
    const products = fetchProductsForMeilisearchStep({ filters, regionId });

    const { publishedProducts, unpublishedIds } = transform(
      { products },
      (data) => {
        const publishedProducts: SyncProductsStepInput["products"] = [];
        const unpublishedIds: string[] = [];
        const queriedProducts = data.products as QueriedProduct[];

        for (const product of queriedProducts) {
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
