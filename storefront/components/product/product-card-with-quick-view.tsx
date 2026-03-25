"use client";

import ProductGridPrice from "components/price/product-grid-price";
import { ProductQuickView } from "components/product/product-quick-view";
import { WishlistButton } from "components/wishlist/wishlist-button";
import { trackClient } from "lib/analytics";
import type { Product } from "lib/types";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type WishlistState = {
  isInWishlist?: boolean;
  wishlistId?: string;
  wishlistItemId?: string;
};

interface ProductCardWithQuickViewProps {
  product: Product;
  wishlistState?: WishlistState;
}

export function ProductCardWithQuickView({
  product,
  wishlistState,
}: ProductCardWithQuickViewProps) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const variantId = product.variants?.[0]?.id ?? "";

  return (
    <div className="group animate-fadeIn">
      <div className="relative">
        <Link href={`/product/${product.handle}`} prefetch={true}>
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-200">
            <Image
              alt={product.featuredImage?.altText || product.title}
              src={
                product.featuredImage?.url || "https://via.placeholder.com/400"
              }
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition duration-300 ease-in-out group-hover:scale-105"
            />
          </div>
        </Link>

        {/* Quick View overlay button */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              setQuickViewOpen(true);
              trackClient("product_quick_view_opened", {
                product_id: product.id,
              });
            }}
            className="focus-visible:outline-primary-600 pointer-events-auto cursor-pointer rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-gray-900 opacity-100 shadow-sm backdrop-blur-sm transition-opacity duration-200 hover:bg-white focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
          >
            Quick View
          </button>
        </div>

        {/* Wishlist heart button */}
        {variantId && (
          <div className="absolute top-2 right-2 z-10">
            <WishlistButton
              variantId={variantId}
              productId={product.id}
              isInWishlist={wishlistState?.isInWishlist}
              wishlistId={wishlistState?.wishlistId}
              wishlistItemId={wishlistState?.wishlistItemId}
              size="sm"
              className="bg-white/80 shadow-sm backdrop-blur-sm hover:bg-white"
            />
          </div>
        )}
      </div>

      <Link href={`/product/${product.handle}`} prefetch={true}>
        <h3 className="mt-4 text-sm text-gray-700">{product.title}</h3>
        <ProductGridPrice
          amount={product.priceRange.maxVariantPrice.amount}
          currencyCode={product.priceRange.maxVariantPrice.currencyCode}
        />
      </Link>

      {/* Quick View modal */}
      <ProductQuickView
        product={product}
        wishlistState={wishlistState}
        open={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
      />
    </div>
  );
}
