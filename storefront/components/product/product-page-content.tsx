"use client";

import { ProductProvider } from "components/product/product-context";
import ProductWrapper from "components/product/product-wrapper";
import { trackClient } from "lib/analytics";
import { Product } from "lib/types";
import { transformProductToTailwindDetail } from "lib/utils";
import { notFound } from "next/navigation";
import { Suspense, use, useEffect, type ReactNode } from "react";

export function ProductPageContent({
  productPromise,
  reviewsSlot,
  relatedProductsSlot,
}: {
  productPromise: Promise<Product | undefined>;
  reviewsSlot: ReactNode;
  relatedProductsSlot: ReactNode;
}) {
  const product = use(productPromise);

  if (!product) return notFound();

  const transformedProduct = transformProductToTailwindDetail(product);

  return (
    <div className="bg-white pb-24">
      <TrackProductView product={product} />
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

function TrackProductView({
  product,
}: {
  product: Product;
}) {
  useEffect(() => {
    trackClient("product_viewed", {
      product_id: product.id,
      product_name: product.title,
      price: Number(product.priceRange.minVariantPrice.amount) || 0,
      category: product.tags?.[0] ?? "",
      variant_count: product.variants?.length ?? 0,
      has_reviews: false,
      avg_rating: 0,
    });
  }, [product]);

  return null;
}
