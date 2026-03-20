"use server";

import { getProducts } from "lib/medusa";
import { Product } from "lib/types";
import { trackServer } from "lib/analytics-server";

export async function searchProducts(
  query: string,
): Promise<{ results: Product[]; totalCount: number }> {
  try {
    const products = await getProducts({
      query,
      sortKey: "RELEVANCE",
      reverse: false,
      limit: 8,
    });
    try { await trackServer("search_performed", { query, result_count: products.length }) } catch {}
    return {
      results: products,
      totalCount: products.length,
    };
  } catch (error) {
    console.error("Search error:", error);
    return { results: [], totalCount: 0 };
  }
}
