import ProductGrid from "components/layout/product-grid";
import { defaultSort, sorting } from "lib/constants";
import { getProducts } from "lib/medusa";
import { buildItemListJsonLd, JsonLdScript } from "lib/structured-data";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse all products.",
  alternates: { canonical: "/products" },
};

export default async function ProductsPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const { sort } = (searchParams || {}) as { [key: string]: string };
  const { sortKey, reverse } =
    sorting.find((item) => item.slug === sort) || defaultSort;

  const products = await getProducts({ sortKey, reverse });
  const itemListJsonLd = buildItemListJsonLd(
    products.map((product, index) => ({
      position: index + 1,
      name: product.title,
      path: `/product/${product.handle}`,
      image: product.featuredImage?.url,
    })),
  );

  return (
    <div>
      {products.length > 0 ? <ProductGrid products={products} /> : null}
      <JsonLdScript data={itemListJsonLd} />
    </div>
  );
}
