const { MeiliSearch } = require("meilisearch")
import { MedusaError } from "@medusajs/framework/utils"
import type { MeilisearchOptions } from "./types"

const MEDUSA_ID_RE = /^[a-zA-Z0-9_]+$/

export default class MeilisearchModuleService {
  private client_: InstanceType<typeof MeiliSearch>
  private options_: MeilisearchOptions

  constructor({}, options: MeilisearchOptions) {
    if (!options.host || !options.apiKey || !options.productIndexName) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Meilisearch host, apiKey, and productIndexName are required"
      )
    }

    this.client_ = new MeiliSearch({
      host: options.host,
      apiKey: options.apiKey,
    })
    this.options_ = options
  }

  async configureIndex(): Promise<void> {
    const index = this.client_.index(this.options_.productIndexName)

    const task1 = await index.updateSearchableAttributes([
      "title",
      "description",
      "handle",
      "tag_values",
      "collection_titles",
    ])
    await index.tasks.waitForTask(task1.taskUid)

    const task2 = await index.updateFilterableAttributes([
      "collection_titles",
      "availability",
      "variant_prices",
      "tag_values",
    ])
    await index.tasks.waitForTask(task2.taskUid)

    const task3 = await index.updateSortableAttributes([
      "title",
      "created_at",
      "variant_prices",
    ])
    await index.tasks.waitForTask(task3.taskUid)
  }

  async indexData(data: Record<string, unknown>[]): Promise<void> {
    const index = this.client_.index(this.options_.productIndexName)
    const task = await index.addDocuments(data)
    await index.tasks.waitForTask(task.taskUid)
  }

  async deleteFromIndex(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const index = this.client_.index(this.options_.productIndexName)
    const task = await index.deleteDocuments(ids)
    await index.tasks.waitForTask(task.taskUid)
  }

  async retrieveFromIndex(
    ids: string[],
  ): Promise<Record<string, unknown>[]> {
    if (ids.length === 0) return []
    const index = this.client_.index(this.options_.productIndexName)
    // Validate IDs match Medusa format to prevent filter injection
    const validIds = ids.filter((id) => MEDUSA_ID_RE.test(id))
    if (validIds.length === 0) return []
    try {
      const sanitized = validIds.map((id) => `"${id}"`)
      const results = await index.getDocuments({
        filter: `id IN [${sanitized.join(", ")}]`,
        limit: validIds.length,
      })
      return results.results as Record<string, unknown>[]
    } catch (error) {
      console.warn("[Meilisearch] Failed to retrieve from index:", error)
      return []
    }
  }

  async getAllIndexedIds(): Promise<string[]> {
    const index = this.client_.index(this.options_.productIndexName)
    const ids: string[] = []
    let offset = 0
    const limit = 1000

    while (true) {
      const results = await index.getDocuments({
        fields: ["id"],
        limit,
        offset,
      })
      for (const doc of results.results) {
        if (doc.id != null) ids.push(String(doc.id))
      }
      if (results.results.length < limit) break
      offset += limit
    }

    return ids
  }

  getOptions(): MeilisearchOptions {
    return this.options_
  }
}
