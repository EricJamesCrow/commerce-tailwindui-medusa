import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MEILISEARCH_MODULE } from "../modules/meilisearch"
import MeilisearchModuleService from "../modules/meilisearch/service"
import { syncProductsWorkflow } from "../workflows/sync-products"

export default async function handleMeilisearchSync({
  container,
}: SubscriberArgs<Record<string, never>>) {
  const logger = container.resolve("logger")

  let meilisearchService: MeilisearchModuleService
  try {
    meilisearchService = container.resolve<MeilisearchModuleService>(
      MEILISEARCH_MODULE
    )
  } catch {
    return
  }

  const startTime = Date.now()
  logger.info("[Meilisearch] Starting full product sync")

  await syncProductsWorkflow(container).run({
    input: {},
  })

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: {},
  })
  const medusaIds = new Set(allProducts.map((p: { id: string }) => p.id))
  const indexedIds = await meilisearchService.getAllIndexedIds()
  const staleIds = indexedIds.filter((id) => !medusaIds.has(id))

  if (staleIds.length > 0) {
    logger.info(`[Meilisearch] Removing ${staleIds.length} stale entries`)
    await meilisearchService.deleteFromIndex(staleIds)
  }

  const duration = Date.now() - startTime
  logger.info(
    `[Meilisearch] Full sync completed in ${duration}ms — ${allProducts.length} products`
  )
}

export const config: SubscriberConfig = {
  event: "meilisearch.sync",
}
