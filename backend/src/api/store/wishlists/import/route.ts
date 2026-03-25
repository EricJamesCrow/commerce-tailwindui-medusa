import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import { WISHLIST_MODULE } from "../../../../modules/wishlist";
import WishlistModuleService from "../../../../modules/wishlist/service";
import { PostImportWishlistSchema } from "../validators";
import { verifyShareToken, requireSalesChannelId } from "../helpers";

type PostReq = z.infer<typeof PostImportWishlistSchema>;

export async function POST(
  req: AuthenticatedMedusaRequest<PostReq>,
  res: MedusaResponse,
) {
  const salesChannelId = requireSalesChannelId(req);
  const wishlistId = verifyShareToken(
    req,
    req.validatedBody.share_token,
    "This share link has expired",
  );

  const query = req.scope.resolve("query");
  const wishlistService: WishlistModuleService =
    req.scope.resolve(WISHLIST_MODULE);

  // Fetch source wishlist
  const { data } = await query.graph({
    entity: "wishlist",
    fields: ["*", "items.*"],
    filters: { id: wishlistId },
  });

  if (!data.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Source wishlist not found",
    );
  }

  const source = data[0];

  // Clone: create new wishlist for this customer
  const newWishlist = await wishlistService.createWishlists({
    customer_id: req.auth_context.actor_id,
    sales_channel_id: salesChannelId,
    name: source.name ? `${source.name} (imported)` : "Imported Wishlist",
  });

  // Clone items, skipping duplicates
  for (const item of source.items ?? []) {
    if (!item) continue;
    try {
      await wishlistService.createWishlistItems({
        wishlist_id: newWishlist.id,
        product_variant_id: item.product_variant_id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("unique") && !message.includes("duplicate")) {
        console.warn(
          `[wishlist-import] Failed to clone item ${item.product_variant_id}:`,
          message,
        );
      }
    }
  }

  // Fetch the complete new wishlist
  const { data: result } = await query.graph({
    entity: "wishlist",
    fields: [
      "*",
      "items.*",
      "items.product_variant.*",
      "items.product_variant.product.*",
    ],
    filters: { id: newWishlist.id },
  });

  res.status(201).json({ wishlist: result[0] });
}
