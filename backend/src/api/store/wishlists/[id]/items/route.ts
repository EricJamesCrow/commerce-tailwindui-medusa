import type {
  MedusaStoreRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { createWishlistItemWorkflow } from "../../../../../workflows/create-wishlist-item";
import { PostGuestCreateWishlistItemSchema } from "../../validators";
import {
  requireSalesChannelId,
  requireGuestWishlistOwnership,
} from "../../helpers";

type PostReq = z.infer<typeof PostGuestCreateWishlistItemSchema>;

export async function POST(
  req: MedusaStoreRequest<PostReq>,
  res: MedusaResponse,
) {
  const salesChannelId = requireSalesChannelId(req);
  await requireGuestWishlistOwnership(req, req.params.id);

  const { result } = await createWishlistItemWorkflow(req.scope).run({
    input: {
      variant_id: req.validatedBody.variant_id,
      wishlist_id: req.params.id,
      sales_channel_id: salesChannelId,
    },
  });

  res.json({ wishlist: result.wishlist });
}
