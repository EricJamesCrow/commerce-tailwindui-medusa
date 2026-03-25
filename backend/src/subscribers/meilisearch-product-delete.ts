import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";
import * as Sentry from "@sentry/node";
import { deleteProductsFromMeilisearchWorkflow } from "../workflows/delete-products-from-meilisearch";

export default async function handleMeilisearchProductDelete({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");

  try {
    container.resolve("meilisearch");
  } catch {
    return;
  }

  logger.info(`[Meilisearch] Deleting product ${data.id} from index`);

  try {
    await deleteProductsFromMeilisearchWorkflow(container).run({
      input: { ids: [data.id] },
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { subscriber: "meilisearch_product_delete", product_id: data.id },
      level: "warning",
    });
    logger.warn(`[Meilisearch] Failed to delete product ${data.id}: ${error}`);
  }
}

export const config: SubscriberConfig = {
  event: "product.deleted",
};
