import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { deleteWishlistItemWorkflow } from "../../../../../../../../workflows/delete-wishlist-item";

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
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

  const { result } = await deleteWishlistItemWorkflow(req.scope).run({
    input: {
      wishlist_item_id: req.params.itemId,
      wishlist_id: req.params.id,
    },
  });

  res.json({ wishlist: result.wishlist });
}
