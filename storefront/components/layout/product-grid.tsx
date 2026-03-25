import { ProductCardWithQuickView } from "components/product/product-card-with-quick-view";
import { getVariantsWishlistStates } from "lib/medusa/wishlist";
import { Product } from "lib/types";

export default async function ProductGrid({
  products,
}: {
  products: Product[];
}) {
  const variantIds = products
    .map((p) => p.variants?.[0]?.id)
    .filter((id): id is string => Boolean(id));

  const wishlistStates = await getVariantsWishlistStates(variantIds);

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
      {products.map((product) => {
        const variantId = product.variants?.[0]?.id ?? "";
        const wlState = wishlistStates.get(variantId);
        return (
          <ProductCardWithQuickView
            key={product.id}
            product={product}
            wishlistState={wlState}
          />
        );
      })}
    </div>
  );
}
