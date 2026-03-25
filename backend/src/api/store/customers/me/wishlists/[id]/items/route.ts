import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import { createWishlistItemWorkflow } from "../../../../../../../workflows/create-wishlist-item";
import { requireSalesChannelId } from "../../../../../wishlists/helpers";
import { PostCreateWishlistItemSchema } from "../../validators";

type PostReq = z.infer<typeof PostCreateWishlistItemSchema>;

export async function POST(
  req: AuthenticatedMedusaRequest<PostReq>,
  res: MedusaResponse,
) {
  const salesChannelId = requireSalesChannelId(req);

  // Verify wishlist belongs to the authenticated customer
  const query = req.scope.resolve("query");
  const { data } = await query.graph({
    entity: "wishlist",
    fields: ["id"],
    filters: {
      id: req.params.id,
      customer_id: req.auth_context.actor_id,
    },
  });

  if (!data.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Wishlist not found");
  }

  const { result } = await createWishlistItemWorkflow(req.scope).run({
    input: {
      variant_id: req.validatedBody.variant_id,
      wishlist_id: req.params.id,
      sales_channel_id: salesChannelId,
    },
  });

  res.json({ wishlist: result.wishlist });
}
