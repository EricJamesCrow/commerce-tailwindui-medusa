import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import { reorderWorkflow } from "../../../../../../../workflows/reorder";

const ReorderParamsSchema = z.object({
  id: z.string().regex(/^order_[a-z0-9]+$/, "Invalid order ID format"),
});

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const parsed = ReorderParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid order ID" });
  }

  const customerId = req.auth_context.actor_id;

  // Verify customer owns this order (IDOR prevention)
  const query = req.scope.resolve("query");
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "customer_id"],
    filters: { id: parsed.data.id },
  });
  const order = orders[0];
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found");
  }
  if (order.customer_id !== customerId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found");
  }

  const { result } = await reorderWorkflow(req.scope).run({
    input: {
      orderId: parsed.data.id,
      customerId,
    },
  });

  res.status(201).json({ cart: result.cart });
}
