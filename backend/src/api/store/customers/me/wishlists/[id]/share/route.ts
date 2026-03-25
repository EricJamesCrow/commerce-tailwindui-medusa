import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import jwt from "jsonwebtoken";

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const query = req.scope.resolve("query");

  const { data } = await query.graph({
    entity: "wishlist",
    fields: ["*"],
    filters: {
      id: req.params.id,
      customer_id: req.auth_context.actor_id,
    },
  });

  if (!data.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Wishlist not found");
  }

  const { http } = req.scope.resolve("configModule").projectConfig;
  if (!http.jwtSecret) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "JWT secret is not configured",
    );
  }

  const token = jwt.sign({ wishlist_id: data[0].id }, http.jwtSecret, {
    expiresIn: "7d",
  });

  res.json({ token });
}
