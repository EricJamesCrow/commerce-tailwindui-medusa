"use client";

import { ProductProvider } from "components/product/product-context";
import ProductWrapper from "components/product/product-wrapper";
import { trackClient } from "lib/analytics";
import { Product, ProductReviews } from "lib/types";
import { transformProductToTailwindDetail } from "lib/utils";
import { notFound } from "next/navigation";
import { Suspense, use, useEffect, type ReactNode } from "react";

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

  // Track product view on mount (client-side, avoids "use cache" restriction)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    trackClient("product_viewed", {
      product_id: product.id,
      product_name: product.title,
      price: Number(product.priceRange.minVariantPrice.amount) || 0,
      category: product.tags?.[0] ?? "",
      variant_count: product.variants?.length ?? 0,
      has_reviews: (reviewsData?.count ?? 0) > 0,
      avg_rating: reviewsData?.averageRating ?? 0,
    });
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const transformedProduct = transformProductToTailwindDetail(
    product,
    reviewsData?.averageRating,
  );

  return (
    <div className="bg-white pb-24">
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
