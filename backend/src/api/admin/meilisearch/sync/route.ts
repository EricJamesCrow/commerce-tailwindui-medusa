import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { MEILISEARCH_MODULE } from "../../../../modules/meilisearch";
import MeilisearchModuleService from "../../../../modules/meilisearch/service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve("logger");

  let meilisearchService: MeilisearchModuleService;
  try {
    meilisearchService =
      req.scope.resolve<MeilisearchModuleService>(MEILISEARCH_MODULE);
  } catch {
    res.status(400).json({
      message: "Meilisearch module is not configured",
    });
    return;
  }

  await meilisearchService.configureIndex();

  const eventBus = req.scope.resolve(Modules.EVENT_BUS);
  await eventBus.emit({
    name: "meilisearch.sync",
    data: {},
  });

  logger.info("[Meilisearch] Admin triggered full product sync");

  res.json({
    message: "Syncing data to Meilisearch",
  });
}
