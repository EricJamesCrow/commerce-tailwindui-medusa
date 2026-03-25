import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import { verifyUnsubscribeToken } from "../../../../utils/newsletter-token";
import { unsubscribeFromNewsletterWorkflow } from "../../../../workflows/newsletter/unsubscribe-from-newsletter";
import { UnsubscribeSchema } from "../validators";

type PostBody = z.infer<typeof UnsubscribeSchema>;

export async function POST(req: MedusaRequest<PostBody>, res: MedusaResponse) {
  const { token } = req.validatedBody;

  const result = verifyUnsubscribeToken(token);
  if (!result) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid or expired unsubscribe token",
    );
  }

  await unsubscribeFromNewsletterWorkflow(req.scope).run({
    input: { email: result.email },
  });

  res.json({ success: true });
}
