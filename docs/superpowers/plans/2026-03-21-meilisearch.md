# Meilisearch Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Meilisearch-powered full-text search with faceted filtering to the CrowCommerce monorepo, with graceful fallback to Medusa REST search when Meilisearch is not configured.

**Architecture:** Custom Medusa v2 module wraps the Meilisearch JS client. Workflows handle indexing (following the official Medusa Meilisearch guide pattern). Subscribers trigger workflows on product events. The storefront queries Meilisearch directly from the browser using `react-instantsearch` hooks wired to TailwindUI filter components.

**Tech Stack:** `meilisearch` (JS client), `react-instantsearch`, `@meilisearch/instant-meilisearch`, Headless UI, Medusa v2 workflows/subscribers

**Spec:** `docs/superpowers/specs/2026-03-21-meilisearch-design.md`

---

## File Map

### Backend (new files)

| File | Purpose |
|---|---|
| `backend/src/modules/meilisearch/index.ts` | Module definition — exports `MEILISEARCH_MODULE` constant and `Module()` registration |
| `backend/src/modules/meilisearch/service.ts` | `MeilisearchModuleService` — wraps Meilisearch JS client with `indexData()`, `deleteFromIndex()`, `retrieveFromIndex()`, `configureIndex()` |
| `backend/src/modules/meilisearch/types.ts` | `MeilisearchOptions` type |
| `backend/src/workflows/sync-products.ts` | `syncProductsWorkflow` — uses `useQueryGraphStep` to fetch products, then indexes published / deletes unpublished |
| `backend/src/workflows/steps/sync-products.ts` | `syncProductsStep` — resolves Meilisearch service, calls `indexData()` |
| `backend/src/workflows/steps/delete-products-from-meilisearch.ts` | `deleteProductsFromMeilisearchStep` — resolves Meilisearch service, calls `deleteFromIndex()` |
| `backend/src/workflows/delete-products-from-meilisearch.ts` | `deleteProductsFromMeilisearchWorkflow` — wraps the delete step |
| `backend/src/subscribers/meilisearch-product-sync.ts` | Listens to `product.created`, `product.updated` — runs `syncProductsWorkflow` |
| `backend/src/subscribers/meilisearch-product-delete.ts` | Listens to `product.deleted` — runs `deleteProductsFromMeilisearchWorkflow` |
| `backend/src/api/admin/meilisearch/sync/route.ts` | `POST /admin/meilisearch/sync` — triggers full reindex |

### Backend (modified files)

| File | Change |
|---|---|
| `backend/medusa-config.ts` | Add conditional Meilisearch module registration |
| `backend/package.json` | Add `meilisearch` dependency |

### Storefront (new files)

| File | Purpose |
|---|---|
| `storefront/lib/meilisearch.ts` | Feature flag (`MEILISEARCH_ENABLED`), `searchClient`, `indexName`, `meilisearchClient` |
| `storefront/app/(store)/search/meilisearch-results.tsx` | `'use client'` — InstantSearch wrapper with TailwindUI filter sidebar, product grid, pagination |

### Storefront (modified files)

| File | Change |
|---|---|
| `storefront/components/search-command/use-search.tsx` | Add conditional Meilisearch search path |
| `storefront/components/search-command/actions.ts` | Add `source: "medusa"` to existing `search_performed` event |
| `storefront/app/(store)/search/page.tsx` | Conditional render: `MeilisearchResults` or existing grid |
| `storefront/lib/analytics.ts` | Add new event types to `AnalyticsEvents` |
| `storefront/package.json` | Add `react-instantsearch`, `@meilisearch/instant-meilisearch`, `meilisearch` dependencies |

### Docs (new files)

| File | Purpose |
|---|---|
| `docs/features/search.md` | Setup guide, how it works, customization guide |

---

## Task 1: Backend — Meilisearch Module

**Files:**
- Create: `backend/src/modules/meilisearch/types.ts`
- Create: `backend/src/modules/meilisearch/service.ts`
- Create: `backend/src/modules/meilisearch/index.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Install `meilisearch` dependency**

```bash
cd backend && bun add meilisearch
```

- [ ] **Step 2: Create types file**

Create `backend/src/modules/meilisearch/types.ts`:

```ts
export type MeilisearchOptions = {
  host: string
  apiKey: string
  productIndexName: string
}
```

- [ ] **Step 3: Create the service**

Create `backend/src/modules/meilisearch/service.ts`:

```ts
const { MeiliSearch } = require("meilisearch")
import { MedusaError } from "@medusajs/framework/utils"
import type { MeilisearchOptions } from "./types"

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

    await index.updateSearchableAttributes([
      "title",
      "description",
      "handle",
      "tag_values",
      "collection_titles",
    ])

    await index.updateFilterableAttributes([
      "collection_titles",
      "availability",
      "variant_prices",
      "status",
      "tag_values",
    ])

    await index.updateSortableAttributes([
      "title",
      "created_at",
      "variant_prices",
    ])
  }

  async indexData(
    data: Record<string, unknown>[],
  ): Promise<void> {
    const index = this.client_.index(this.options_.productIndexName)
    await index.addDocuments(data)
  }

  async deleteFromIndex(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const index = this.client_.index(this.options_.productIndexName)
    await index.deleteDocuments(ids)
  }

  async retrieveFromIndex(
    ids: string[],
  ): Promise<Record<string, unknown>[]> {
    if (ids.length === 0) return []
    const index = this.client_.index(this.options_.productIndexName)
    try {
      const results = await index.getDocuments({
        filter: `id IN [${ids.map((id) => `"${id}"`).join(", ")}]`,
        limit: ids.length,
      })
      return results.results as Record<string, unknown>[]
    } catch {
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
        ids.push(doc.id as string)
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
```

- [ ] **Step 4: Create module definition**

Create `backend/src/modules/meilisearch/index.ts`:

```ts
import { Module } from "@medusajs/framework/utils"
import MeilisearchModuleService from "./service"

export const MEILISEARCH_MODULE = "meilisearch"

export default Module(MEILISEARCH_MODULE, {
  service: MeilisearchModuleService,
})
```

- [ ] **Step 5: Verify module loads**

Start the backend with `MEILISEARCH_HOST` and `MEILISEARCH_API_KEY` env vars set. Check logs for no errors. (Skip if no Meilisearch server available — the module won't load without env vars, which is expected.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/meilisearch/ backend/package.json backend/bun.lock
git commit -m "feat(backend): add Meilisearch module with service and index configuration"
```

---

## Task 2: Backend — Sync Workflows

**Files:**
- Create: `backend/src/workflows/steps/sync-products.ts`
- Create: `backend/src/workflows/steps/delete-products-from-meilisearch.ts`
- Create: `backend/src/workflows/sync-products.ts`
- Create: `backend/src/workflows/delete-products-from-meilisearch.ts`

**Reference:** Follow the official Medusa Meilisearch guide pattern — use `useQueryGraphStep` to fetch products, `transform` to split published/unpublished, then custom steps for indexing/deleting.

- [ ] **Step 1: Create the sync products step**

Create `backend/src/workflows/steps/sync-products.ts`:

```ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MEILISEARCH_MODULE } from "../../modules/meilisearch"
import MeilisearchModuleService from "../../modules/meilisearch/service"

export type SyncProductsStepInput = {
  products: {
    id: string
    title: string
    description?: string | null
    handle: string
    thumbnail?: string | null
    collection_titles: string[]
    tag_values: string[]
    variant_prices: number[]
    availability: boolean
    created_at: string
    updated_at: string
  }[]
}

export const syncProductsStep = createStep(
  "sync-products-to-meilisearch",
  async ({ products }: SyncProductsStepInput, { container }) => {
    if (products.length === 0) return new StepResponse(undefined, { indexed: [] })

    const meilisearchService = container.resolve<MeilisearchModuleService>(
      MEILISEARCH_MODULE
    )

    await meilisearchService.indexData(
      products as unknown as Record<string, unknown>[]
    )

    return new StepResponse(undefined, {
      indexed: products.map((p) => p.id),
    })
  }
)
```

- [ ] **Step 2: Create the delete products step**

Create `backend/src/workflows/steps/delete-products-from-meilisearch.ts`:

```ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MEILISEARCH_MODULE } from "../../modules/meilisearch"
import MeilisearchModuleService from "../../modules/meilisearch/service"

export type DeleteProductsStepInput = {
  ids: string[]
}

export const deleteProductsFromMeilisearchStep = createStep(
  "delete-products-from-meilisearch",
  async ({ ids }: DeleteProductsStepInput, { container }) => {
    if (ids.length === 0) return new StepResponse(undefined, { deleted: [] })

    const meilisearchService = container.resolve<MeilisearchModuleService>(
      MEILISEARCH_MODULE
    )

    await meilisearchService.deleteFromIndex(ids)

    return new StepResponse(undefined, { deleted: ids })
  }
)
```

- [ ] **Step 3: Create the sync products workflow**

Create `backend/src/workflows/sync-products.ts`:

```ts
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { syncProductsStep, SyncProductsStepInput } from "./steps/sync-products"
import { deleteProductsFromMeilisearchStep } from "./steps/delete-products-from-meilisearch"

type SyncProductsWorkflowInput = {
  filters?: Record<string, unknown>
}

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
    })

    const { publishedProducts, unpublishedIds } = transform(
      { products },
      (data) => {
        const publishedProducts: SyncProductsStepInput["products"] = []
        const unpublishedIds: string[] = []

        for (const product of data.products) {
          if (product.status === "published") {
            // Extract collection titles
            const collection_titles: string[] = []
            if (product.collection?.title) {
              collection_titles.push(product.collection.title)
            }

            // Extract tag values
            const tag_values = (product.tags || [])
              .map((t: { value?: string }) => t.value)
              .filter(Boolean) as string[]

            // Extract variant prices (major currency units)
            const variant_prices: number[] = []
            for (const variant of product.variants || []) {
              for (const price of variant.prices || []) {
                if (typeof price.amount === "number") {
                  variant_prices.push(price.amount)
                }
              }
            }

            // Check availability (any variant in stock)
            const availability = (product.variants || []).some(
              (v: { manage_inventory?: boolean; inventory_quantity?: number }) =>
                !v.manage_inventory || (v.inventory_quantity ?? 0) > 0
            )

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
            })
          } else {
            unpublishedIds.push(product.id)
          }
        }

        return { publishedProducts, unpublishedIds }
      }
    )

    syncProductsStep({ products: publishedProducts })
    deleteProductsFromMeilisearchStep({ ids: unpublishedIds })

    return new WorkflowResponse({ products })
  }
)
```

- [ ] **Step 4: Create the delete products workflow**

Create `backend/src/workflows/delete-products-from-meilisearch.ts`:

```ts
import { createWorkflow } from "@medusajs/framework/workflows-sdk"
import { deleteProductsFromMeilisearchStep } from "./steps/delete-products-from-meilisearch"

type DeleteProductsFromMeilisearchWorkflowInput = {
  ids: string[]
}

export const deleteProductsFromMeilisearchWorkflow = createWorkflow(
  "delete-products-from-meilisearch-workflow",
  (input: DeleteProductsFromMeilisearchWorkflowInput) => {
    deleteProductsFromMeilisearchStep(input)
  }
)
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/workflows/steps/sync-products.ts backend/src/workflows/steps/delete-products-from-meilisearch.ts backend/src/workflows/sync-products.ts backend/src/workflows/delete-products-from-meilisearch.ts
git commit -m "feat(backend): add Meilisearch sync and delete workflows"
```

---

## Task 3: Backend — Subscribers & Admin Sync Route

**Files:**
- Create: `backend/src/subscribers/meilisearch-product-sync.ts`
- Create: `backend/src/subscribers/meilisearch-product-delete.ts`
- Create: `backend/src/api/admin/meilisearch/sync/route.ts`

- [ ] **Step 1: Create product sync subscriber**

Create `backend/src/subscribers/meilisearch-product-sync.ts`:

```ts
import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { syncProductsWorkflow } from "../workflows/sync-products"

export default async function handleMeilisearchProductSync({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    // Check if Meilisearch module is registered
    container.resolve("meilisearch")
  } catch {
    // Module not registered — skip silently
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
```

- [ ] **Step 2: Create product delete subscriber**

Create `backend/src/subscribers/meilisearch-product-delete.ts`:

```ts
import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { deleteProductsFromMeilisearchWorkflow } from "../workflows/delete-products-from-meilisearch"

export default async function handleMeilisearchProductDelete({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    container.resolve("meilisearch")
  } catch {
    return
  }

  logger.info(`[Meilisearch] Deleting product ${data.id} from index`)

  try {
    await deleteProductsFromMeilisearchWorkflow(container).run({
      input: { ids: [data.id] },
    })
  } catch (error) {
    logger.warn(
      `[Meilisearch] Failed to delete product ${data.id}: ${error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "product.deleted",
}
```

- [ ] **Step 3: Create admin sync route**

The admin sync route emits a `meilisearch.sync` event (async) per the spec, rather than running the workflow synchronously. This prevents HTTP timeouts on large catalogs.

Create `backend/src/api/admin/meilisearch/sync/route.ts`:

```ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { MEILISEARCH_MODULE } from "../../../../modules/meilisearch"
import MeilisearchModuleService from "../../../../modules/meilisearch/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve("logger")

  let meilisearchService: MeilisearchModuleService
  try {
    meilisearchService = req.scope.resolve<MeilisearchModuleService>(
      MEILISEARCH_MODULE
    )
  } catch {
    res.status(400).json({
      message: "Meilisearch module is not configured",
    })
    return
  }

  // Configure index settings before sync
  await meilisearchService.configureIndex()

  // Emit event for async processing by the meilisearch-sync subscriber
  const eventBus = req.scope.resolve(Modules.EVENT_BUS)
  await eventBus.emit({
    name: "meilisearch.sync",
    data: {},
  })

  logger.info("[Meilisearch] Admin triggered full product sync")

  res.json({
    message: "Syncing data to Meilisearch",
  })
}
```

- [ ] **Step 4: Create the full sync subscriber**

Create `backend/src/subscribers/meilisearch-sync.ts`:

```ts
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

  // Fetch all products via the workflow (handles indexing + removing unpublished)
  const { result } = await syncProductsWorkflow(container).run({
    input: {},
  })

  // Clean up stale entries: products that exist in the index but not in Medusa
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
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/subscribers/meilisearch-product-sync.ts backend/src/subscribers/meilisearch-product-delete.ts backend/src/subscribers/meilisearch-sync.ts backend/src/api/admin/meilisearch/sync/route.ts
git commit -m "feat(backend): add Meilisearch subscribers and admin sync route"
```

---

## Task 4: Backend — Config Registration

**Files:**
- Modify: `backend/medusa-config.ts`

- [ ] **Step 1: Add Meilisearch warning**

Add a console warning after the existing PostHog warning (around line 49), before `module.exports`:

```ts
if (process.env.MEILISEARCH_HOST && !process.env.MEILISEARCH_API_KEY) {
  console.warn(
    "[medusa-config] MEILISEARCH_HOST is set but MEILISEARCH_API_KEY is missing — " +
    "Meilisearch indexing will fail"
  )
}
```

- [ ] **Step 2: Add conditional Meilisearch module to the `modules` array**

Add after the PostHog analytics block (after line 214), before the closing `],`:

```ts
    // Meilisearch search indexing (conditional on MEILISEARCH_HOST)
    ...(process.env.MEILISEARCH_HOST
      ? [
          {
            resolve: "./src/modules/meilisearch",
            options: {
              host: process.env.MEILISEARCH_HOST,
              apiKey: process.env.MEILISEARCH_API_KEY,
              productIndexName:
                process.env.MEILISEARCH_PRODUCT_INDEX_NAME || "products",
            },
          },
        ]
      : []),
```

- [ ] **Step 3: Verify the backend starts**

```bash
cd backend && bun run dev
```

Expected: No errors. Meilisearch module should not load (no env vars set). Check logs — no warnings about Meilisearch.

- [ ] **Step 4: Commit**

```bash
git add backend/medusa-config.ts
git commit -m "feat(backend): register Meilisearch module conditionally in medusa-config"
```

---

## Task 5: Storefront — Meilisearch Client & Analytics Types

**Files:**
- Create: `storefront/lib/meilisearch.ts`
- Modify: `storefront/lib/analytics.ts`
- Modify: `storefront/components/search-command/actions.ts`
- Modify: `storefront/package.json`

- [ ] **Step 1: Install storefront dependencies**

```bash
cd storefront && bun add react-instantsearch @meilisearch/instant-meilisearch meilisearch
```

- [ ] **Step 2: Create Meilisearch client module**

Create `storefront/lib/meilisearch.ts`:

```ts
import { instantMeiliSearch } from "@meilisearch/instant-meilisearch"
import { MeiliSearch } from "meilisearch"

export const MEILISEARCH_ENABLED =
  !!process.env.NEXT_PUBLIC_MEILISEARCH_HOST &&
  !!process.env.NEXT_PUBLIC_MEILISEARCH_API_KEY

export const MEILISEARCH_INDEX_NAME =
  process.env.NEXT_PUBLIC_MEILISEARCH_INDEX_NAME || "products"

// InstantSearch client (for search results page)
export const { searchClient } = MEILISEARCH_ENABLED
  ? instantMeiliSearch(
      process.env.NEXT_PUBLIC_MEILISEARCH_HOST!,
      process.env.NEXT_PUBLIC_MEILISEARCH_API_KEY!
    )
  : { searchClient: null }

// Raw Meilisearch client (for Cmd+K lightweight queries)
export const meilisearchClient = MEILISEARCH_ENABLED
  ? new MeiliSearch({
      host: process.env.NEXT_PUBLIC_MEILISEARCH_HOST!,
      apiKey: process.env.NEXT_PUBLIC_MEILISEARCH_API_KEY!,
    })
  : null
```

- [ ] **Step 3: Add new analytics event types**

In `storefront/lib/analytics.ts`, update the `search_performed` type and add new events. Find the line:

```ts
  search_performed: { query: string; result_count: number }
```

Replace with:

```ts
  search_performed: { query: string; result_count: number; source: "meilisearch" | "medusa" }
  search_facet_applied: { facet_type: string; facet_value: string; query: string }
  search_result_clicked: { query: string; product_id: string; position: number; source: "meilisearch" | "medusa" }
```

- [ ] **Step 4: Update existing `search_performed` call site in `actions.ts`**

In `storefront/components/search-command/actions.ts`, find the line:

```ts
    try { await trackServer("search_performed", { query, result_count: products.length }) } catch {}
```

Replace with:

```ts
    try { await trackServer("search_performed", { query, result_count: products.length, source: "medusa" }) } catch {}
```

- [ ] **Step 5: Commit**

```bash
git add storefront/lib/meilisearch.ts storefront/lib/analytics.ts storefront/components/search-command/actions.ts storefront/package.json storefront/bun.lock
git commit -m "feat(storefront): add Meilisearch client, analytics event types"
```

---

## Task 6: Storefront — Cmd+K Palette Meilisearch Path

**Files:**
- Modify: `storefront/components/search-command/use-search.tsx`

- [ ] **Step 1: Add Meilisearch search path to `useSearch` hook**

Replace the entire contents of `storefront/components/search-command/use-search.tsx` with:

```tsx
"use client"

import { trackClient } from "lib/analytics"
import {
  MEILISEARCH_ENABLED,
  MEILISEARCH_INDEX_NAME,
  meilisearchClient,
} from "lib/meilisearch"
import { Product } from "lib/types"
import { useEffect, useState } from "react"
import { searchProducts } from "./actions"

/**
 * Transform a Meilisearch hit into the storefront Product shape
 * so the existing ProductResult component works unchanged.
 */
function hitToProduct(hit: Record<string, unknown>): Product {
  const prices = (hit.variant_prices as number[]) || []
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0

  return {
    id: hit.id as string,
    handle: hit.handle as string,
    availableForSale: (hit.availability as boolean) ?? true,
    title: hit.title as string,
    description: (hit.description as string) || "",
    descriptionHtml: (hit.description as string) || "",
    options: [],
    priceRange: {
      minVariantPrice: { amount: minPrice.toFixed(2), currencyCode: "USD" },
      maxVariantPrice: { amount: maxPrice.toFixed(2), currencyCode: "USD" },
    },
    variants: [],
    featuredImage: hit.thumbnail
      ? {
          url: hit.thumbnail as string,
          altText: hit.title as string,
          width: 0,
          height: 0,
        }
      : { url: "", altText: hit.title as string, width: 0, height: 0 },
    images: [],
    seo: { title: hit.title as string, description: "" },
    tags: (hit.tag_values as string[]) || [],
    updatedAt: (hit.updated_at as string) || new Date().toISOString(),
  }
}

export function useSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<Product[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query || !enabled) {
      setResults([])
      setTotalCount(0)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        if (MEILISEARCH_ENABLED && meilisearchClient) {
          // Meilisearch path
          const index = meilisearchClient.index(MEILISEARCH_INDEX_NAME)
          const searchResult = await index.search(query, {
            limit: 8,
            filter: "status = published",
          })
          const products = searchResult.hits.map(hitToProduct)
          setResults(products)
          setTotalCount(searchResult.estimatedTotalHits ?? searchResult.hits.length)
          trackClient("search_performed", {
            query,
            result_count: searchResult.hits.length,
            source: "meilisearch",
          })
        } else {
          // Medusa fallback
          const { results: products, totalCount: count } =
            await searchProducts(query)
          setResults(products)
          setTotalCount(count)
        }
      } catch (error) {
        console.error("Search error:", error)
        setResults([])
        setTotalCount(0)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, enabled])

  return { results, totalCount, loading }
}
```

- [ ] **Step 2: Verify the Cmd+K palette still works without Meilisearch env vars**

Start the storefront (`cd storefront && bun dev`), open Cmd+K, type a query. Should see existing Medusa search results. No errors in console.

- [ ] **Step 3: Commit**

```bash
git add storefront/components/search-command/use-search.tsx
git commit -m "feat(storefront): add Meilisearch path to Cmd+K search with fallback"
```

---

## Task 7: Storefront — Meilisearch Search Results Page

**Files:**
- Create: `storefront/app/(store)/search/meilisearch-results.tsx`
- Modify: `storefront/app/(store)/search/page.tsx`

This is the largest task. The `meilisearch-results.tsx` component uses InstantSearch hooks wired to TailwindUI filter components matching the existing `(store)` layout patterns.

**Important layout context:** The `(store)` layout already provides a sidebar + grid structure (`lg:grid-cols-4`) with `Collections` in the sidebar and `SortFilter` in the header. For the Meilisearch search page, the `meilisearch-results.tsx` component will render its own full-page layout (including filters, sort, and grid) and the `page.tsx` wrapper will need to handle the fact that the `(store)` layout provides the outer chrome. The Meilisearch results component should fill the content area and provide its own filter sidebar — replacing the layout's default `Collections` sidebar and sort for this page.

- [ ] **Step 1: Create `meilisearch-results.tsx`**

Create `storefront/app/(store)/search/meilisearch-results.tsx`:

```tsx
"use client"

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react"
import { ChevronDownIcon, FunnelIcon, MinusIcon, PlusIcon } from "@heroicons/react/20/solid"
import { XMarkIcon } from "@heroicons/react/24/outline"
import { trackClient } from "lib/analytics"
import {
  MEILISEARCH_INDEX_NAME,
  searchClient,
} from "lib/meilisearch"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import {
  Configure,
  Hits,
  InstantSearch,
  Pagination,
  RefinementList,
  SearchBox,
  SortBy,
  ToggleRefinement,
  useRange,
  useSearchBox,
  useStats,
} from "react-instantsearch"

// --- Price Range Slider ---
function PriceRangeSlider() {
  const { start, range, refine } = useRange({ attribute: "variant_prices" })
  const min = range.min ?? 0
  const max = range.max ?? 100
  const currentMin = start[0] !== -Infinity ? start[0] ?? min : min
  const currentMax = start[1] !== Infinity ? start[1] ?? max : max

  const [localMin, setLocalMin] = useState(currentMin)
  const [localMax, setLocalMax] = useState(currentMax)

  // Sync local state when InstantSearch state changes
  if (localMin !== currentMin || localMax !== currentMax) {
    setLocalMin(currentMin)
    setLocalMax(currentMax)
  }

  return (
    <div className="pt-6">
      <div className="flex items-center gap-4">
        <input
          type="number"
          min={min}
          max={max}
          value={localMin}
          onChange={(e) => setLocalMin(Number(e.target.value))}
          onBlur={() => refine([localMin, localMax])}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
        />
        <span className="text-sm text-gray-500">to</span>
        <input
          type="number"
          min={min}
          max={max}
          value={localMax}
          onChange={(e) => setLocalMax(Number(e.target.value))}
          onBlur={() => refine([localMin, localMax])}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900"
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>${min.toFixed(0)}</span>
        <span>${max.toFixed(0)}</span>
      </div>
    </div>
  )
}

// --- Product Hit ---
function ProductHit({ hit }: { hit: Record<string, unknown> }) {
  const handle = hit.handle as string
  const title = hit.title as string
  const thumbnail = hit.thumbnail as string | null
  const prices = (hit.variant_prices as number[]) || []
  const minPrice = prices.length ? Math.min(...prices) : 0
  const availability = hit.availability as boolean

  return (
    <Link href={`/product/${handle}`} className="group text-sm">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
        {thumbnail ? (
          <Image
            alt={title}
            src={thumbnail}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover group-hover:opacity-75"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            No image
          </div>
        )}
      </div>
      <h3 className="mt-4 font-medium text-gray-900">{title}</h3>
      {!availability && (
        <p className="text-gray-500 italic">Out of stock</p>
      )}
      <p className="mt-2 font-medium text-gray-900">
        ${minPrice.toFixed(2)}
      </p>
    </Link>
  )
}

// --- Stats Header ---
function SearchStats({ query }: { query: string }) {
  const { nbHits } = useStats()
  const resultsText = nbHits === 1 ? "result" : "results"

  return (
    <p className="text-sm text-gray-500">
      {nbHits === 0
        ? "No products found for "
        : `Showing ${nbHits} ${resultsText} for `}
      <span className="font-semibold text-gray-900">&quot;{query}&quot;</span>
    </p>
  )
}

// --- Filter Sections (shared between desktop & mobile) ---
function FilterSections() {
  return (
    <>
      {/* Collections */}
      <Disclosure as="div" className="border-b border-gray-200 py-6" defaultOpen>
        <h3 className="-my-3 flow-root">
          <DisclosureButton className="group flex w-full items-center justify-between bg-white py-3 text-sm text-gray-400 hover:text-gray-500">
            <span className="font-medium text-gray-900">Collections</span>
            <span className="ml-6 flex items-center">
              <PlusIcon aria-hidden="true" className="size-5 group-data-[open]:hidden" />
              <MinusIcon aria-hidden="true" className="size-5 group-[:not([data-open])]:hidden" />
            </span>
          </DisclosureButton>
        </h3>
        <DisclosurePanel className="pt-6">
          <RefinementList
            attribute="collection_titles"
            classNames={{
              list: "space-y-4",
              item: "flex gap-3",
              checkbox:
                "size-4 appearance-none rounded border border-gray-300 bg-white checked:border-primary-600 checked:bg-primary-600",
              label: "flex items-center gap-3 text-sm text-gray-600 cursor-pointer",
              count: "ml-auto text-xs text-gray-400",
            }}
          />
        </DisclosurePanel>
      </Disclosure>

      {/* Price Range */}
      <Disclosure as="div" className="border-b border-gray-200 py-6" defaultOpen>
        <h3 className="-my-3 flow-root">
          <DisclosureButton className="group flex w-full items-center justify-between bg-white py-3 text-sm text-gray-400 hover:text-gray-500">
            <span className="font-medium text-gray-900">Price Range</span>
            <span className="ml-6 flex items-center">
              <PlusIcon aria-hidden="true" className="size-5 group-data-[open]:hidden" />
              <MinusIcon aria-hidden="true" className="size-5 group-[:not([data-open])]:hidden" />
            </span>
          </DisclosureButton>
        </h3>
        <DisclosurePanel>
          <PriceRangeSlider />
        </DisclosurePanel>
      </Disclosure>

      {/* Availability */}
      <Disclosure as="div" className="border-b border-gray-200 py-6" defaultOpen>
        <h3 className="-my-3 flow-root">
          <DisclosureButton className="group flex w-full items-center justify-between bg-white py-3 text-sm text-gray-400 hover:text-gray-500">
            <span className="font-medium text-gray-900">Availability</span>
            <span className="ml-6 flex items-center">
              <PlusIcon aria-hidden="true" className="size-5 group-data-[open]:hidden" />
              <MinusIcon aria-hidden="true" className="size-5 group-[:not([data-open])]:hidden" />
            </span>
          </DisclosureButton>
        </h3>
        <DisclosurePanel className="pt-6">
          <ToggleRefinement
            attribute="availability"
            label="In stock only"
            classNames={{
              checkbox:
                "size-4 appearance-none rounded border border-gray-300 bg-white checked:border-primary-600 checked:bg-primary-600",
              label: "flex items-center gap-3 text-sm text-gray-600 cursor-pointer",
            }}
          />
        </DisclosurePanel>
      </Disclosure>
    </>
  )
}

// --- Main Component ---
export default function MeilisearchResults({
  initialQuery,
  initialCollection,
}: {
  initialQuery: string
  initialCollection?: string
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  if (!searchClient) return null

  const sortItems = [
    { value: MEILISEARCH_INDEX_NAME, label: "Relevance" },
    { value: `${MEILISEARCH_INDEX_NAME}:title:asc`, label: "Name: A to Z" },
    { value: `${MEILISEARCH_INDEX_NAME}:title:desc`, label: "Name: Z to A" },
    { value: `${MEILISEARCH_INDEX_NAME}:variant_prices:asc`, label: "Price: Low to High" },
    { value: `${MEILISEARCH_INDEX_NAME}:variant_prices:desc`, label: "Price: High to Low" },
    { value: `${MEILISEARCH_INDEX_NAME}:created_at:desc`, label: "Newest" },
  ]

  return (
    <InstantSearch
      searchClient={searchClient}
      indexName={MEILISEARCH_INDEX_NAME}
      initialUiState={{
        [MEILISEARCH_INDEX_NAME]: {
          query: initialQuery,
          ...(initialCollection
            ? {
                refinementList: {
                  collection_titles: [initialCollection],
                },
              }
            : {}),
        },
      }}
    >
      {/* Hidden search box — pre-populated from URL, syncs state */}
      <div className="hidden">
        <SearchBox />
      </div>
      <Configure filters="status = published" hitsPerPage={24} />

      {/* Mobile filter dialog */}
      <Dialog
        open={mobileFiltersOpen}
        onClose={setMobileFiltersOpen}
        className="relative z-40 lg:hidden"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/25 transition-opacity duration-300 ease-linear data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 z-40 flex">
          <DialogPanel
            transition
            className="relative ml-auto flex size-full max-w-xs transform flex-col overflow-y-auto bg-white pt-4 pb-6 shadow-xl transition duration-300 ease-in-out data-[closed]:translate-x-full"
          >
            <div className="flex items-center justify-between px-4">
              <h2 className="text-lg font-medium text-gray-900">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="focus-visible:ring-primary-500 relative -mr-2 flex size-10 items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2"
              >
                <span className="absolute -inset-0.5" />
                <span className="sr-only">Close menu</span>
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>
            </div>
            <div className="mt-4 border-t border-gray-200 px-4">
              <FilterSections />
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Header: stats + sort + mobile filter trigger */}
      <div className="flex items-center justify-between pb-4">
        <SearchStats query={initialQuery} />
        <div className="flex items-center gap-2">
          <SortBy
            items={sortItems}
            classNames={{
              select:
                "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-hidden",
            }}
          />
          <button
            type="button"
            onClick={() => {
              setMobileFiltersOpen(true)
              trackClient("mobile_filters_opened", {})
            }}
            className="-m-2 ml-2 p-2 text-gray-400 hover:text-gray-500 lg:hidden"
          >
            <span className="sr-only">Filters</span>
            <FunnelIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      {/* Desktop: sidebar + grid */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">
        {/* Desktop filters */}
        <div className="hidden lg:block">
          <FilterSections />
        </div>

        {/* Product grid + pagination */}
        <div className="lg:col-span-3">
          <Hits
            hitComponent={ProductHit}
            classNames={{
              list: "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8",
            }}
          />
          <div className="mt-8 flex justify-center">
            <Pagination
              classNames={{
                list: "flex gap-1",
                item: "rounded-md px-3 py-1.5 text-sm",
                selectedItem: "bg-primary-600 text-white",
                disabledItem: "text-gray-300 cursor-not-allowed",
              }}
            />
          </div>
        </div>
      </div>
    </InstantSearch>
  )
}
```

**Note:** The `RefinementList`, `ToggleRefinement`, `SortBy`, `Hits`, and `Pagination` components use `classNames` prop to apply TailwindUI-consistent styling. The exact class names may need tweaking during implementation to match the existing design system — check the actual rendered output and adjust. The `react-instantsearch` `classNames` API maps CSS classes to widget sub-elements.

- [ ] **Step 2: Modify `search/page.tsx` to conditionally render Meilisearch results**

Replace `storefront/app/(store)/search/page.tsx` with:

```tsx
import ProductGrid from "components/layout/product-grid"
import { defaultSort, sorting } from "lib/constants"
import { getProducts } from "lib/medusa"
import { MEILISEARCH_ENABLED } from "lib/meilisearch"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import MeilisearchResults from "./meilisearch-results"

export const metadata: Metadata = {
  title: "Search",
  description: "Search for products in the store.",
  robots: { index: false },
}

export default async function SearchPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const {
    sort,
    q: searchValue,
    collection,
  } = searchParams as { [key: string]: string }

  if (!searchValue) {
    redirect("/products")
  }

  if (MEILISEARCH_ENABLED) {
    return (
      <MeilisearchResults
        initialQuery={searchValue}
        initialCollection={collection}
      />
    )
  }

  // Medusa fallback (unchanged)
  const { sortKey, reverse } =
    sorting.find((item) => item.slug === sort) || defaultSort

  const products = await getProducts({ sortKey, reverse, query: searchValue })
  const resultsText = products.length > 1 ? "results" : "result"

  return (
    <div>
      <p className="mb-4">
        {products.length === 0
          ? "There are no products that match "
          : `Showing ${products.length} ${resultsText} for `}
        <span className="font-bold">&quot;{searchValue}&quot;</span>
      </p>
      {products.length > 0 ? <ProductGrid products={products} /> : null}
    </div>
  )
}
```

- [ ] **Step 3: Verify search page still works without Meilisearch env vars**

```bash
cd storefront && bun dev
```

Navigate to `/search?q=test`. Should show existing Medusa search results. No errors.

- [ ] **Step 4: Commit**

```bash
git add storefront/app/(store)/search/meilisearch-results.tsx storefront/app/(store)/search/page.tsx
git commit -m "feat(storefront): add Meilisearch faceted search results page with fallback"
```

---

## Task 8: Documentation

**Files:**
- Create: `docs/features/search.md`

- [ ] **Step 1: Write the search feature documentation**

Create `docs/features/search.md`:

```markdown
# Search

The storefront supports two search backends: **Meilisearch** (full-text search with faceted filtering) and **Medusa REST** (basic text search). Meilisearch is optional — when not configured, the storefront falls back to Medusa's built-in product search.

## Setup

### Prerequisites

- A running Meilisearch instance ([installation guide](https://www.meilisearch.com/docs/learn/getting_started/installation))
- A search-only API key (never expose the master key to the browser)

### Backend Environment Variables

```env
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=<master-key>
MEILISEARCH_PRODUCT_INDEX_NAME=products    # optional, defaults to "products"
```

### Storefront Environment Variables

```env
NEXT_PUBLIC_MEILISEARCH_HOST=http://127.0.0.1:7700
NEXT_PUBLIC_MEILISEARCH_API_KEY=<search-only-key>
NEXT_PUBLIC_MEILISEARCH_INDEX_NAME=products    # optional, defaults to "products"
```

### Initial Sync

After configuring env vars and starting the backend, trigger a full product sync:

```bash
curl -X POST http://localhost:9000/admin/meilisearch/sync \
  -H "Authorization: Bearer <admin-token>"
```

This indexes all published products. Subsequent changes sync automatically via event subscribers.

## How It Works

### Backend Indexing

- **Module:** `backend/src/modules/meilisearch/` — wraps the Meilisearch JS client
- **Workflows:** `sync-products` (index/update) and `delete-products-from-meilisearch` (remove)
- **Subscribers:** Listen to `product.created`, `product.updated`, `product.deleted` events
- **Admin route:** `POST /admin/meilisearch/sync` triggers a full reindex

### Storefront Search

- **Cmd+K palette:** Queries Meilisearch directly via the JS client (8 results, debounced 300ms)
- **Search results page:** Uses `react-instantsearch` with faceted filters (collections, price range, availability)
- **Fallback:** When `NEXT_PUBLIC_MEILISEARCH_HOST` is not set, both paths use Medusa's REST API

### Indexed Fields

Each product document in Meilisearch contains:

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Medusa product ID |
| `title` | string | Searchable |
| `description` | string | Searchable |
| `handle` | string | Searchable, used for product URLs |
| `thumbnail` | string | Product image |
| `collection_titles` | string[] | Filterable, searchable |
| `tag_values` | string[] | Filterable, searchable |
| `variant_prices` | number[] | Filterable (range), sortable |
| `availability` | boolean | Filterable (in-stock toggle) |
| `created_at` | string | Sortable |

## Customizing for Your Store

### Adding Filterable Attributes

1. **Backend:** Update the `useQueryGraphStep` fields in `backend/src/workflows/sync-products.ts` to include the new field
2. **Backend:** Add the field to the `transform` block that builds the indexed document
3. **Backend:** Add the field to `filterableAttributes` in `backend/src/modules/meilisearch/service.ts` → `configureIndex()`
4. **Backend:** Trigger a full reindex: `POST /admin/meilisearch/sync`

### Adding a Facet UI Section

In `storefront/app/(store)/search/meilisearch-results.tsx`, add a new `<Disclosure>` section inside `FilterSections()`:

```tsx
<Disclosure as="div" className="border-b border-gray-200 py-6" defaultOpen>
  <h3 className="-my-3 flow-root">
    <DisclosureButton className="group flex w-full items-center justify-between bg-white py-3 text-sm text-gray-400 hover:text-gray-500">
      <span className="font-medium text-gray-900">Your Facet Name</span>
      {/* ... expand/collapse icons ... */}
    </DisclosureButton>
  </h3>
  <DisclosurePanel className="pt-6">
    <RefinementList attribute="your_attribute_name" />
  </DisclosurePanel>
</Disclosure>
```

### Changing Searchable Fields

Update `searchableAttributes` in `backend/src/modules/meilisearch/service.ts` → `configureIndex()`. The order matters — earlier fields are weighted higher in relevance.

### Adjusting Sort Options

Update the `sortItems` array in `storefront/app/(store)/search/meilisearch-results.tsx`. Sort indices use the format `indexName:attribute:direction`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Search returns no results | Index is empty | Run `POST /admin/meilisearch/sync` |
| Facet counts show 0 | Attribute not in `filterableAttributes` | Add to `configureIndex()` and reindex |
| "Invalid API key" error | Wrong key type | Use master key for backend, search-only key for storefront |
| Products not updating | Subscriber not firing | Check backend logs for `[Meilisearch]` messages; verify module is loaded |
| Storefront shows Medusa results | Missing env vars | Verify `NEXT_PUBLIC_MEILISEARCH_HOST` and `NEXT_PUBLIC_MEILISEARCH_API_KEY` are set |
```

- [ ] **Step 2: Commit**

```bash
git add docs/features/search.md
git commit -m "docs: add search feature documentation with setup and customization guide"
```

---

## Task 9: Integration Testing & Polish

This task verifies everything works end-to-end with a running Meilisearch instance. If no Meilisearch server is available, verify fallback behavior and skip Meilisearch-specific steps.

- [ ] **Step 1: Verify fallback behavior (no Meilisearch)**

With no `MEILISEARCH_HOST` or `NEXT_PUBLIC_MEILISEARCH_HOST` env vars:
1. Start backend: `cd backend && bun run dev` — no Meilisearch warnings
2. Start storefront: `cd storefront && bun dev`
3. Open Cmd+K, search for a product — results from Medusa REST
4. Navigate to `/search?q=test` — results from Medusa REST, no facets
5. No console errors

- [ ] **Step 2: Verify Meilisearch integration (if server available)**

With env vars configured:
1. Start backend with Meilisearch env vars
2. Hit `POST /admin/meilisearch/sync` to trigger initial index
3. Check Meilisearch dashboard — products should be indexed
4. Start storefront with Meilisearch env vars
5. Cmd+K search — results from Meilisearch (faster, typo-tolerant)
6. `/search?q=test` — faceted search page with filters
7. Test collection filter, price range, availability toggle
8. Test sort options
9. Test pagination
10. Test `/search?q=test&collection=CollectionName` — collection pre-filtered

- [ ] **Step 3: Verify `variant_prices` range filtering**

Per spec note: test that a product with variants at different prices shows up when the price range filter includes any of its variant prices. If this doesn't work correctly with `useRange` on arrays, update the index schema to use `min_price`/`max_price` fields instead.

- [ ] **Step 4: Typecheck**

```bash
bun run typecheck
```

Expected: No type errors.

- [ ] **Step 5: Build check**

```bash
bun run build
```

Expected: Successful build.

- [ ] **Step 6: Final commit (if any adjustments)**

```bash
git add -p  # stage specific changes
git commit -m "fix(storefront): polish Meilisearch search integration"
```
