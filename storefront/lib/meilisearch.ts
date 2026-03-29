import { instantMeiliSearch } from "@meilisearch/instant-meilisearch";
import { MeiliSearch } from "meilisearch";
import { Product } from "lib/types";
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

const DEFAULT_CURRENCY_CODE = "USD";

export type MeilisearchProductDocument = {
  id: string;
  title: string;
  description?: string | null;
  handle: string;
  thumbnail?: string | null;
  collection_titles?: string[];
  collection_handles?: string[];
  tag_values?: string[];
  variant_prices?: number[];
  min_variant_price?: number | null;
  max_variant_price?: number | null;
  availability?: boolean;
  created_at?: string;
  updated_at?: string;
};

type SearchIndexedProductsOptions = {
  collection?: string | null;
  availability?: boolean;
  limit?: number;
  maxPrice?: number | null;
  minPrice?: number | null;
  offset?: number;
  sort?: string | null;
};

type SearchIndexedProductsResult = {
  hits: MeilisearchProductDocument[];
  totalCount: number;
};

function buildFacetFilters({
  availability,
  collection,
  maxPrice,
  minPrice,
}: Omit<SearchIndexedProductsOptions, "limit" | "offset" | "sort">): string[] {
  const filters: string[] = [];

  if (collection) {
    filters.push(`collection_handles = "${collection}"`);
  }

  if (availability) {
    filters.push("availability = true");
  }

  if (typeof minPrice === "number") {
    filters.push(`variant_prices >= ${minPrice}`);
  }

  if (typeof maxPrice === "number") {
    filters.push(`variant_prices <= ${maxPrice}`);
  }

  return filters;
}

function getSortExpression(sort?: string | null): string[] | undefined {
  switch (sort) {
    case "latest-desc":
    case "trending-desc":
      return ["created_at:desc"];
    case "price-asc":
      return ["min_variant_price:asc"];
    case "price-desc":
      return ["max_variant_price:desc"];
    default:
      return undefined;
  }
}

export function meilisearchHitToProduct(
  hit: MeilisearchProductDocument,
): Product {
  const prices = hit.variant_prices || [];
  const minPrice =
    hit.min_variant_price ?? (prices.length ? Math.min(...prices) : 0);
  const maxPrice =
    hit.max_variant_price ?? (prices.length ? Math.max(...prices) : 0);

  return {
    id: hit.id,
    handle: hit.handle,
    availableForSale: hit.availability ?? true,
    title: hit.title,
    description: hit.description || "",
    descriptionHtml: hit.description || "",
    options: [],
    priceRange: {
      minVariantPrice: {
        amount: Number(minPrice || 0).toFixed(2),
        currencyCode: DEFAULT_CURRENCY_CODE,
      },
      maxVariantPrice: {
        amount: Number(maxPrice || 0).toFixed(2),
        currencyCode: DEFAULT_CURRENCY_CODE,
      },
    },
    variants: [],
    featuredImage: hit.thumbnail
      ? {
          url: hit.thumbnail,
          altText: hit.title,
          width: 0,
          height: 0,
        }
      : { url: "", altText: hit.title, width: 0, height: 0 },
    images: [],
    seo: { title: hit.title, description: "" },
    tags: hit.tag_values || [],
    updatedAt: hit.updated_at || new Date().toISOString(),
  };
}

export async function searchIndexedProducts(
  query: string,
  {
    availability,
    collection,
    limit = 24,
    maxPrice,
    minPrice,
    offset = 0,
    sort,
  }: SearchIndexedProductsOptions = {},
): Promise<SearchIndexedProductsResult> {
  if (!MEILISEARCH_ENABLED || !meilisearchClient) {
    return { hits: [], totalCount: 0 };
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { hits: [], totalCount: 0 };
  }

  const filters = buildFacetFilters({
    availability,
    collection,
    maxPrice,
    minPrice,
  });
  const index = meilisearchClient.index(MEILISEARCH_INDEX_NAME);
  const result = await index.search<MeilisearchProductDocument>(trimmedQuery, {
    limit,
    offset,
    filter: filters.length ? filters : undefined,
    sort: getSortExpression(sort),
  });

  return {
    hits: result.hits,
    totalCount: result.estimatedTotalHits ?? result.hits.length,
  };
}
