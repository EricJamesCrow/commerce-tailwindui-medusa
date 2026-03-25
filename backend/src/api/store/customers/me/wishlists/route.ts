import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { createWishlistWorkflow } from "../../../../../workflows/create-wishlist";
import { requireSalesChannelId } from "../../../wishlists/helpers";
import { WishlistNameSchema } from "./validators";

type PostReq = z.infer<typeof WishlistNameSchema>;

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
      customer_id: req.auth_context.actor_id,
    },
  });

  res.json({ wishlists: data });
}

export async function POST(
  req: AuthenticatedMedusaRequest<PostReq>,
  res: MedusaResponse,
) {
  const salesChannelId = requireSalesChannelId(req);

  const { result } = await createWishlistWorkflow(req.scope).run({
    input: {
      customer_id: req.auth_context.actor_id,
      sales_channel_id: salesChannelId,
      name: req.validatedBody?.name,
    },
  });

  res.status(201).json({ wishlist: result.wishlist });
}
