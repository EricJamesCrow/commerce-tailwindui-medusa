"use client";

import { trackClient, redactPiiFromQuery } from "lib/analytics";
import {
  MEILISEARCH_ENABLED,
  MEILISEARCH_INDEX_NAME,
  meilisearchClient,
} from "lib/meilisearch";
import { Product } from "lib/types";
import { useEffect, useState } from "react";
import { searchProducts } from "./actions";

// Default currency code — update per-store or read from region config
const DEFAULT_CURRENCY_CODE = "USD";

/**
 * Transform a Meilisearch hit into the storefront Product shape
 * so the existing ProductResult component works unchanged.
 */
function hitToProduct(hit: Record<string, unknown>): Product {
  const prices = (hit.variant_prices as number[]) || [];
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  return {
    id: hit.id as string,
    handle: hit.handle as string,
    availableForSale: (hit.availability as boolean) ?? true,
    title: hit.title as string,
    description: (hit.description as string) || "",
    descriptionHtml: (hit.description as string) || "",
    options: [],
    priceRange: {
      minVariantPrice: {
        amount: minPrice.toFixed(2),
        currencyCode: DEFAULT_CURRENCY_CODE,
      },
      maxVariantPrice: {
        amount: maxPrice.toFixed(2),
        currencyCode: DEFAULT_CURRENCY_CODE,
      },
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
  };
}

export function useSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || !enabled) {
      setResults([]);
      setTotalCount(0);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (MEILISEARCH_ENABLED && meilisearchClient) {
          const index = meilisearchClient.index(MEILISEARCH_INDEX_NAME);
          const searchResult = await index.search(query, {
            limit: 8,
          });
          const products = searchResult.hits.map(hitToProduct);
          setResults(products);
          setTotalCount(
            searchResult.estimatedTotalHits ?? searchResult.hits.length,
          );
          trackClient("search_performed", {
            query: redactPiiFromQuery(query),
            result_count: searchResult.hits.length,
            source: "meilisearch",
          });
        } else {
          const { results: products, totalCount: count } =
            await searchProducts(query);
          setResults(products);
          setTotalCount(count);
        }
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, enabled]);

  return { results, totalCount, loading };
}
