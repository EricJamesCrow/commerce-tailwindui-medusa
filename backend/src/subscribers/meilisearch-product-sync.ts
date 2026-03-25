import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";
import * as Sentry from "@sentry/node";
import { syncProductsWorkflow } from "../workflows/sync-products";

export default async function handleMeilisearchProductSync({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");

  try {
    container.resolve("meilisearch");
  } catch {
    return;
  }

  logger.info(`[Meilisearch] Syncing product ${data.id}`);

  try {
    await syncProductsWorkflow(container).run({
      input: {
        filters: { id: data.id },
      },
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { subscriber: "meilisearch_product_sync", product_id: data.id },
      level: "warning",
    });
    logger.warn(`[Meilisearch] Failed to sync product ${data.id}: ${error}`);
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
};
