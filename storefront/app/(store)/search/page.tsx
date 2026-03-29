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

  const parsedMinPrice = Number(minPrice);
  const parsedMaxPrice = Number(maxPrice);

  const meilisearchEnabledForRequest = MEILISEARCH_ENABLED;
  const meilisearchResults = meilisearchEnabledForRequest
    ? await searchIndexedProducts(searchValue, {
        availability: availability === "in_stock" ? true : undefined,
        collection: collection || null,
        minPrice: Number.isFinite(parsedMinPrice) ? parsedMinPrice : null,
        maxPrice: Number.isFinite(parsedMaxPrice) ? parsedMaxPrice : null,
        sort,
      })
    : null;

  const products = meilisearchResults
    ? await getProductsByHandles(
        meilisearchResults.hits.map((hit) => hit.handle),
      )
    : await getProducts({ sortKey, reverse, query: searchValue });
  const resultCount = meilisearchResults?.totalCount ?? products.length;
  const resultsText = resultCount === 1 ? "result" : "results";

  return (
    <div>
      <p className="mb-4">
        {resultCount === 0
          ? "There are no products that match "
          : `Showing ${resultCount} ${resultsText} for `}
        <span className="font-bold">&quot;{searchValue}&quot;</span>
      </p>
      {products.length > 0 ? <ProductGrid products={products} /> : null}
    </div>
  );
}
