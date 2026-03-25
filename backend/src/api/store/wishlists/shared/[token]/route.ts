import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { verifyShareToken } from "../../helpers";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const wishlistId = verifyShareToken(
    req,
    req.params.token,
    "This wishlist link has expired. Ask the owner to share a new link.",
  );

  const query = req.scope.resolve("query");

  const { data } = await query.graph({
    entity: "wishlist",
    fields: [
      "*",
      "items.*",
      "items.product_variant.*",
      "items.product_variant.product.*",
    ],
    filters: { id: wishlistId },
  });

  if (!data.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Wishlist not found");
  }

  res.json({ wishlist: data[0] });
}
