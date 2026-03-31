import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { MedusaError } from "@medusajs/framework/utils";
import { unsubscribeFromNewsletterWorkflow } from "../../../../workflows/newsletter/unsubscribe-from-newsletter";
import { UnsubscribeSchema } from "../validators";

type PostBody = z.infer<typeof UnsubscribeSchema>;

export async function POST(req: MedusaRequest<PostBody>, res: MedusaResponse) {
  const { token } = req.validatedBody;

  try {
    await unsubscribeFromNewsletterWorkflow(req.scope).run({
      input: { token },
    });
  } catch (error) {
    if (
      error instanceof MedusaError &&
      error.type === MedusaError.Types.INVALID_DATA
    ) {
      return res.status(400).json({
        message: "Invalid or expired unsubscribe token",
      });
    }

    throw error;
  }

  res.json({ success: true });
}
