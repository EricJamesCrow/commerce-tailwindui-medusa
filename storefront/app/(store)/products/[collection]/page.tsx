import ProductGrid from "components/layout/product-grid";
import { defaultSort, sorting } from "lib/constants";
import {
  getCollection,
  getCollectionProducts,
  getCollections,
} from "lib/medusa";
import {
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  JsonLdScript,
} from "lib/structured-data";
import { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  const collections = await getCollections();

  return collections.map((collection) => ({
    collection: collection.handle,
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ collection: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const collection = await getCollection(params.collection);

  if (!collection) return notFound();

  return {
    title: collection.seo?.title || collection.title,
    description:
      collection.seo?.description ||
      collection.description ||
      `${collection.title} products`,
    alternates: { canonical: `/products/${params.collection}` },
  };
}

export default async function ProductsCollectionPage(props: {
  params: Promise<{ collection: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { sort } = (searchParams || {}) as { [key: string]: string };
  const { sortKey, reverse } =
    sorting.find((item) => item.slug === sort) || defaultSort;
  const [collection, products] = await Promise.all([
    getCollection(params.collection),
    getCollectionProducts({ collection: params.collection, sortKey, reverse }),
  ]);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Products", path: "/products" },
    {
      name: collection?.title || params.collection,
      path: `/products/${params.collection}`,
    },
  ]);
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
      {products.length === 0 ? (
        <p className="py-3 text-lg">{`No products found in this collection`}</p>
      ) : (
        <ProductGrid products={products} />
      )}
      <JsonLdScript data={breadcrumbJsonLd} />
      <JsonLdScript data={itemListJsonLd} />
    </div>
  );
}
