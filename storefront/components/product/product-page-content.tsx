"use client";

import { ProductProvider } from "components/product/product-context";
import ProductWrapper from "components/product/product-wrapper";
import { safeJsonLd } from "lib/json-ld";
import { Product, ProductReviews } from "lib/types";
import { baseUrl, transformProductToTailwindDetail } from "lib/utils";
import { notFound } from "next/navigation";
import { Suspense, use, type ReactNode } from "react";

export function ProductPageContent({
  productPromise,
  reviewsPromise,
  reviewsSlot,
  relatedProductsSlot,
}: {
  productPromise: Promise<Product | undefined>;
  reviewsPromise: Promise<ProductReviews | null>;
  reviewsSlot: ReactNode;
  relatedProductsSlot: ReactNode;
}) {
  const product = use(productPromise);
  const reviewsData = use(reviewsPromise);

  if (!product) return notFound();

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.featuredImage?.url,
    offers: {
      "@type": "AggregateOffer",
      availability: product.availableForSale
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      priceCurrency: product.priceRange.minVariantPrice.currencyCode,
      highPrice: product.priceRange.maxVariantPrice.amount,
      lowPrice: product.priceRange.minVariantPrice.amount,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${baseUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Products",
        item: `${baseUrl}/products`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.title,
        item: `${baseUrl}/product/${product.handle}`,
      },
    ],
  };

  const transformedProduct = transformProductToTailwindDetail(
    product,
    reviewsData?.averageRating,
  );

  return (
    <div className="bg-white pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(productJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(breadcrumbJsonLd),
        }}
      />
      <Suspense fallback={null}>
        <ProductProvider>
          <ProductWrapper
            product={product}
            transformedProduct={transformedProduct}
          />
        </ProductProvider>
      </Suspense>
      {reviewsSlot}
      {relatedProductsSlot}
    </div>
  );
}
