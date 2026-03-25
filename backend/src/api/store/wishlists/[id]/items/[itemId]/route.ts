import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { deleteWishlistItemWorkflow } from "../../../../../../workflows/delete-wishlist-item";
import { requireGuestWishlistOwnership } from "../../../helpers";

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await requireGuestWishlistOwnership(req, req.params.id);

  const { result } = await deleteWishlistItemWorkflow(req.scope).run({
    input: {
      wishlist_item_id: req.params.itemId,
      wishlist_id: req.params.id,
    },
  });

  res.json({ wishlist: result.wishlist });
}
