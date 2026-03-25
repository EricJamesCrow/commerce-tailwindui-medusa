import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { deleteWishlistWorkflow } from "../../../../../../workflows/delete-wishlist";
import { updateWishlistWorkflow } from "../../../../../../workflows/update-wishlist";
import { WishlistNameSchema } from "../validators";

type PutReq = z.infer<typeof WishlistNameSchema>;

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const query = req.scope.resolve("query");

  const { data } = await query.graph({
    entity: "wishlist",
    fields: [
      "*",
      "items.*",
      "items.product_variant.*",
      "items.product_variant.product.*",
    ],
    filters: {
      id: req.params.id,
      customer_id: req.auth_context.actor_id,
    },
  });

  if (!data.length) {
    return res.status(404).json({ message: "Wishlist not found" });
  }

  res.json({ wishlist: data[0] });
}

export async function PUT(
  req: AuthenticatedMedusaRequest<PutReq>,
  res: MedusaResponse,
) {
  const { result } = await updateWishlistWorkflow(req.scope).run({
    input: {
      wishlist_id: req.params.id,
      customer_id: req.auth_context.actor_id,
      name: req.validatedBody?.name,
    },
  });

  res.json({ wishlist: result.wishlist });
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  await deleteWishlistWorkflow(req.scope).run({
    input: {
      wishlist_id: req.params.id,
      customer_id: req.auth_context.actor_id,
    },
  });

  res.json({ success: true });
}
