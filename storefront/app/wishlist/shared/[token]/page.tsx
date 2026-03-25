import { getSharedWishlist } from "lib/medusa/wishlist";
import { retrieveCustomer } from "lib/medusa/customer";
import { ImportButton } from "./import-button";
import type { WishlistItem } from "lib/types";
import type { Metadata } from "next";
import {
  HeartIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shared Wishlist",
};

export default async function SharedWishlistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [wishlist, customer] = await Promise.all([
    getSharedWishlist(token),
    retrieveCustomer(),
  ]);

  if (!wishlist) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto size-12 text-gray-400" />
          <h1 className="mt-4 text-lg font-semibold text-gray-900">
            Wishlist Not Available
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            This wishlist link has expired or is no longer available. Ask the
            owner to share a new link.
          </p>
          <div className="mt-8">
            <Link
              href="/products"
              className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const items = wishlist.items ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <HeartIcon className="text-primary-600 size-6" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {wishlist.name || "Shared Wishlist"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        {customer && <ImportButton shareToken={token} />}
      </div>

      {/* Items grid */}
      {items.length > 0 ? (
        <div className="mt-10 grid grid-cols-1 gap-y-12 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3 xl:gap-x-8">
          {items.map((item) => (
            <SharedWishlistItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <ShoppingBagIcon className="mx-auto size-12 text-gray-400" />
          <p className="mt-4 text-sm text-gray-500">This wishlist is empty.</p>
        </div>
      )}

      {/* Sign in prompt for unauthenticated users */}
      {!customer && items.length > 0 && (
        <div className="mt-12 rounded-lg bg-gray-50 p-6 text-center">
          <HeartIcon className="mx-auto size-8 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-900">
            Want to save these items?
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to import this wishlist to your account.
          </p>
          <div className="mt-4">
            <Link
              href="/account/login"
              className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SharedWishlistItemCard (read-only, no remove/add-to-cart actions)
// ---------------------------------------------------------------------------

function SharedWishlistItemCard({ item }: { item: WishlistItem }) {
  const variant = item.product_variant;
  const product = variant?.product;
  const thumbnail = product?.thumbnail;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Product image */}
      {thumbnail ? (
        <Link
          href={product?.handle ? `/product/${product.handle}` : "#"}
          prefetch={true}
        >
          <Image
            src={thumbnail}
            alt={product?.title || "Product image"}
            width={400}
            height={400}
            className="aspect-[3/4] w-full bg-gray-200 object-cover group-hover:opacity-75 sm:aspect-auto sm:h-72"
          />
        </Link>
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center bg-gray-100 sm:aspect-auto sm:h-72">
          <ShoppingBagIcon className="size-12 text-gray-300" />
        </div>
      )}

      {/* Product info */}
      <div className="flex flex-1 flex-col space-y-2 p-4">
        {product ? (
          <h3 className="text-sm font-medium text-gray-900">
            <Link href={`/product/${product.handle}`}>
              <span aria-hidden="true" className="absolute inset-0" />
              {product.title}
            </Link>
          </h3>
        ) : (
          <h3 className="text-sm font-medium text-gray-900">Unknown product</h3>
        )}

        {variant?.title && variant.title !== "Default" && (
          <p className="text-sm text-gray-500">{variant.title}</p>
        )}
      </div>
    </div>
  );
}
