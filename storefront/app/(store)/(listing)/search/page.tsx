import ProductGrid from "components/layout/product-grid";
import { defaultSort, sorting } from "lib/constants";
import { getProducts, getProductsByHandles } from "lib/medusa";
import { MEILISEARCH_ENABLED, searchIndexedProducts } from "lib/meilisearch";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Search",
  description: "Search for products in the store.",
  robots: { index: false },
};

function getFirstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePriceParam(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export default async function SearchPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const availability = getFirstParam(searchParams?.availability);
  const collection = getFirstParam(searchParams?.collection);
  const maxPrice = getFirstParam(searchParams?.maxPrice);
  const minPrice = getFirstParam(searchParams?.minPrice);
  const sort = getFirstParam(searchParams?.sort);
  const searchValue = getFirstParam(searchParams?.q);

  if (!searchValue) {
    redirect("/products");
  }

  const { sortKey, reverse } =
    sorting.find((item) => item.slug === sort) || defaultSort;

  const parsedMinPrice = parsePriceParam(minPrice);
  const parsedMaxPrice = parsePriceParam(maxPrice);

  const meilisearchEnabledForRequest = MEILISEARCH_ENABLED;
  const meilisearchResults = meilisearchEnabledForRequest
    ? await searchIndexedProducts(searchValue, {
        availability: availability === "in_stock" ? true : undefined,
        collection: collection || null,
        minPrice: parsedMinPrice,
        maxPrice: parsedMaxPrice,
        sort,
      })
    : null;

  const products = meilisearchResults
    ? await getProductsByHandles(
        meilisearchResults.hits.map((hit) => hit.handle),
      )
    : await getProducts({ sortKey, reverse, query: searchValue });
  const shownCount = products.length;
  const totalCount = meilisearchResults?.totalCount ?? shownCount;
  const resultsText = totalCount === 1 ? "result" : "results";

  return (
    <div>
      <p className="mb-4">
        {totalCount === 0
          ? "There are no products that match "
          : totalCount > shownCount
            ? `Showing ${shownCount} of ${totalCount} ${resultsText} for `
            : `Showing ${shownCount} ${resultsText} for `}
        <span className="font-bold">&quot;{searchValue}&quot;</span>
      </p>
      {products.length > 0 ? <ProductGrid products={products} /> : null}
    </div>
  );
}
