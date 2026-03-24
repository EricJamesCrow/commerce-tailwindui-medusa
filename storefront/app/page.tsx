"use cache";
import { Collections } from "components/home/collections";
import { Hero } from "components/home/hero";
import { TrendingProducts } from "components/home/trending-products";
import { getCollections, getProducts } from "lib/medusa";
import {
  buildOrganizationJsonLd,
  getSiteSchemaConfig,
  JsonLdScript,
} from "lib/structured-data";
import {
  transformCollectionToTailwind,
  transformProductToTailwind,
} from "lib/utils";
import { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  description:
    "High-performance ecommerce store built with Next.js, Vercel, and Medusa.",
  openGraph: {
    type: "website",
  },
};

export default async function HomePage() {
  // Fetch products from Medusa - most recent first
  const allProducts = await getProducts({
    sortKey: "CREATED_AT",
    reverse: true,
    limit: 4,
  });

  // Transform and limit to 4 products for trending section
  const trendingProducts = allProducts
    .slice(0, 4)
    .map(transformProductToTailwind);

  // Fetch collections from Medusa
  const allCollections = await getCollections();

  // Transform and limit to 3 collections (skip the "All" collection at index 0)
  const collections = allCollections
    .slice(1, 4)
    .map(transformCollectionToTailwind);
  const organizationJsonLd = buildOrganizationJsonLd(
    getSiteSchemaConfig({
      description:
        "High-performance ecommerce store built with Next.js, Vercel, and Medusa.",
    }),
  );

  return (
    <>
      <JsonLdScript data={organizationJsonLd} />
      <Hero />
      <TrendingProducts products={trendingProducts} />
      <Collections collections={collections} />
    </>
  );
}
