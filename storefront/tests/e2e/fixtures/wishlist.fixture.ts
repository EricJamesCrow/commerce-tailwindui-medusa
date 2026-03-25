import { test as authTest, expect } from "./auth.fixture";

type WishlistFixtures = {
  /** Creates a wishlist with items pre-populated via API, returns metadata */
  populatedWishlist: {
    wishlistId: string;
    items: { id: string; variantId: string }[];
    productHandles: string[];
  };
  /** First available product handle for navigation */
  testProductHandle: string;
  /** First available variant ID for adding to wishlist */
  testVariantId: string;
};

export const test = authTest.extend<WishlistFixtures>({
  populatedWishlist: async ({ api }, use) => {
    // Get available products
    const products = await api.getProducts();
    if (products.length < 1) {
      throw new Error(
        "No products found in Medusa. Run the seed script first.",
      );
    }

    // Create a wishlist with 2 items
    const wishlist = await api.createWishlist("Test Wishlist");
    const items: { id: string; variantId: string }[] = [];
    const handles: string[] = [];

    for (const product of products.slice(0, 2)) {
      const variant = product.variants?.[0];
      if (!variant) continue;
      await api.addWishlistItem(wishlist.id, variant.id);
      handles.push(product.handle);
    }

    // Re-fetch to get item IDs
    const wishlists = await api.listWishlists();
    const wl = wishlists.find((w) => w.id === wishlist.id);
    if (wl) {
      for (const item of wl.items) {
        items.push({ id: item.id, variantId: item.product_variant_id });
      }
    }

    await use({
      wishlistId: wishlist.id,
      items,
      productHandles: handles,
    });

    // Cleanup
    try {
      await api.deleteWishlist(wishlist.id);
    } catch {
      // Best-effort cleanup
    }
  },

  testProductHandle: async ({ api }, use) => {
    const products = await api.getProducts();
    if (products.length < 1) {
      throw new Error("No products found. Run seed script.");
    }
    await use(products[0]!.handle);
  },

  testVariantId: async ({ api }, use) => {
    const products = await api.getProducts();
    if (products.length < 1 || !products[0]!.variants?.[0]) {
      throw new Error("No products/variants found. Run seed script.");
    }
    await use(products[0]!.variants[0]!.id);
  },
});

export { expect };
