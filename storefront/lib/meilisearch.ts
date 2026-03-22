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
