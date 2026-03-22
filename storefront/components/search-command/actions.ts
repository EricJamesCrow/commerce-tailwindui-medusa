"use server";

import { getProducts } from "lib/medusa";
import { Product } from "lib/types";
import { trackServer } from "lib/analytics-server";

export async function searchProducts(
  query: string,
): Promise<{ results: Product[]; totalCount: number }> {
  const sanitizedQuery = query.trim().slice(0, 120);
  if (!sanitizedQuery) {
    return { results: [], totalCount: 0 };
  }

  try {
    const products = await getProducts({
      query: sanitizedQuery,
      sortKey: "RELEVANCE",
      reverse: false,
      limit: 8,
    });
    try { await trackServer("search_performed", { query: sanitizedQuery, result_count: products.length, source: "medusa" }) } catch {}
    return {
      results: products,
      totalCount: products.length,
    };
  } catch (error) {
    console.error("Search error:", error);
    return { results: [], totalCount: 0 };
  }
}
