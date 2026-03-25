import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductPageContent } from "components/product/product-page-content";
import { RelatedProducts as RelatedProductsComponent } from "components/product/related-products";
import { ProductReviewsSection } from "components/reviews/ProductReviewsSection";
import { HIDDEN_PRODUCT_TAG } from "lib/constants";
import { getProduct, getProductRecommendations, getProducts } from "lib/medusa";
import { getProductReviews } from "lib/medusa/reviews";
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  JsonLdScript,
} from "lib/structured-data";
import type { Product } from "lib/types";
import { transformProductsToRelatedProducts } from "lib/utils";
import { Suspense } from "react";

export async function generateMetadata(props: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const product = await getProduct(params.handle);

  if (!product) return notFound();

  const { url, width, height, altText: alt } = product.featuredImage || {};
  const indexable = !product.tags.includes(HIDDEN_PRODUCT_TAG);

  return {
    title: product.seo.title || product.title,
    description: product.seo.description || product.description,
    alternates: {
      canonical: `/product/${product.handle}`,
    },
    robots: {
      index: indexable,
      follow: indexable,
      googleBot: {
        index: indexable,
        follow: indexable,
      },
    },
    openGraph: url
      ? {
          images: [
            {
              url,
              width,
              height,
              alt,
            },
          ],
        }
      : null,
  };
}

export async function generateStaticParams() {
  try {
    const products = await getProducts({});
    return products.map((product) => ({ handle: product.handle }));
  } catch {
    return [];
  }
}

export default async function ProductPage(props: {
  params: Promise<{ handle: string }>;
}) {
  const params = await props.params;
  const productPromise = getProduct(params.handle);
  const product = await productPromise;

  if (!product) return notFound();

  const reviewsPromise = getProductReviews(product.id);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Products", path: "/products" },
    { name: product.title, path: `/product/${product.handle}` },
  ]);

  return (
    <>
      <JsonLdScript data={breadcrumbJsonLd} />
      <ProductStructuredData product={product} />
      <ProductPageContent
        productPromise={productPromise}
        reviewsSlot={
          <Suspense
            fallback={
              <div className="mx-auto max-w-7xl px-4 py-8">
                <div className="h-32 animate-pulse rounded bg-gray-200" />
              </div>
            }
          >
            <ProductReviewsSection productPromise={productPromise} />
          </Suspense>
        }
        relatedProductsSlot={
          <Suspense
            fallback={
              <div className="mx-auto max-w-7xl px-4 py-8">
                <h2 className="mb-4 text-xl font-bold text-gray-900">
                  Customers also bought
                </h2>
                <div className="h-24 animate-pulse rounded bg-gray-200" />
              </div>
            }
          >
            <RelatedProducts productPromise={productPromise} />
          </Suspense>
        }
      />
    </>
  );
}

function ProductStructuredData({ product }: { product: Product }) {
  const productJsonLd = buildProductJsonLd(product, null);

  return <JsonLdScript data={productJsonLd} />;
}

async function RelatedProducts({
  productPromise,
}: {
  productPromise: Promise<Product | undefined>;
}) {
  // Await the product promise
  const product = await productPromise;
  if (!product) return null;

  const relatedProducts = await getProductRecommendations(product.id);

  if (!relatedProducts.length) return null;

  // Transform products for Tailwind component
  const transformedRelatedProducts =
    transformProductsToRelatedProducts(relatedProducts);

  return (
    <RelatedProductsComponent
      products={transformedRelatedProducts}
      fullProducts={relatedProducts}
    />
  );
}
