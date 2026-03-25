import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { transferWishlistWorkflow } from "../../../../../../../workflows/transfer-wishlist";
import { requireSalesChannelId } from "../../../../../wishlists/helpers";

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const salesChannelId = requireSalesChannelId(req);

  const { result } = await transferWishlistWorkflow(req.scope).run({
    input: {
      wishlist_id: req.params.id,
      customer_id: req.auth_context.actor_id,
      sales_channel_id: salesChannelId,
    },
  });

  res.json({ wishlist: result.wishlist });
}
