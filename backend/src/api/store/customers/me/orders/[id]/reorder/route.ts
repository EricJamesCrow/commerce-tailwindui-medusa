import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";

const REORDER_DISABLED_MESSAGE =
  "Reordering is temporarily unavailable while checkout is being hardened.";

// Order IDs are system-generated ULIDs (e.g. order_01JNBA2VQ...) and are
// never typed by a user, so they must NOT be lowercased — unlike email
// addresses which are normalized to lowercase at the auth boundary.
const ReorderParamsSchema = z.object({
  id: z.string().regex(/^order_[a-zA-Z0-9]+$/, "Invalid order ID format"),
});

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const parsed = ReorderParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid order ID" });
  }

  return res.status(503).json({
    message: REORDER_DISABLED_MESSAGE,
    error_code: "temporarily_unavailable",
  });
}
