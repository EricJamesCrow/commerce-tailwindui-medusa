import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { syncProductsWorkflow } from "../workflows/sync-products"

export default async function handleMeilisearchProductSync({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    container.resolve("meilisearch")
  } catch {
    return
  }

  logger.info(`[Meilisearch] Syncing product ${data.id}`)

  try {
    await syncProductsWorkflow(container).run({
      input: {
        filters: { id: data.id },
      },
    })
  } catch (error) {
    logger.warn(`[Meilisearch] Failed to sync product ${data.id}: ${error}`)
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
