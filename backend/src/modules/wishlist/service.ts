import { MedusaService } from "@medusajs/framework/utils";
import { Wishlist } from "./models/wishlist";
import { WishlistItem } from "./models/wishlist-item";

class WishlistModuleService extends MedusaService({
  Wishlist,
  WishlistItem,
}) {
  async getWishlistsOfVariants(variantIds: string[]): Promise<number> {
    if (!variantIds.length) return 0;

    // Use the auto-generated list method with filters
    const items = await this.listWishlistItems(
      { product_variant_id: variantIds },
      { take: null },
    );

    // Count unique wishlist IDs
    const uniqueWishlists = new Set(items.map((item) => item.wishlist_id));
    return uniqueWishlists.size;
  }
}

export default WishlistModuleService;
