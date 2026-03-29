import { instantMeiliSearch } from "@meilisearch/instant-meilisearch";
import { MeiliSearch } from "meilisearch";
import { sanitizeEnvValue } from "./env";

const meilisearchHost = sanitizeEnvValue(
  process.env.NEXT_PUBLIC_MEILISEARCH_HOST,
);
const meilisearchApiKey = sanitizeEnvValue(
  process.env.NEXT_PUBLIC_MEILISEARCH_API_KEY,
);
const meilisearchMasterKey = sanitizeEnvValue(process.env.MEILISEARCH_API_KEY);

export const MEILISEARCH_ENABLED = !!meilisearchHost && !!meilisearchApiKey;

// Warn if the storefront key matches the backend master key
if (
  MEILISEARCH_ENABLED &&
  meilisearchMasterKey &&
  meilisearchApiKey === meilisearchMasterKey
) {
  console.warn(
    "[meilisearch] WARNING: NEXT_PUBLIC_MEILISEARCH_API_KEY matches the backend master key. " +
      "This exposes full admin access to the browser. Use a search-only API key. " +
      "See: https://www.meilisearch.com/docs/learn/security/basic_security",
  );
}

export const MEILISEARCH_INDEX_NAME =
  sanitizeEnvValue(process.env.NEXT_PUBLIC_MEILISEARCH_INDEX_NAME) ||
  "products";

// InstantSearch client (for search results page)
export const { searchClient } = MEILISEARCH_ENABLED
  ? instantMeiliSearch(meilisearchHost!, meilisearchApiKey!)
  : { searchClient: null };

// Raw Meilisearch client (for Cmd+K lightweight queries)
export const meilisearchClient = MEILISEARCH_ENABLED
  ? new MeiliSearch({
      host: meilisearchHost!,
      apiKey: meilisearchApiKey!,
    })
  : null;
