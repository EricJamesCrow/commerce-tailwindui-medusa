import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { unsubscribeFromNewsletterWorkflow } from "../../../../workflows/newsletter/unsubscribe-from-newsletter";
import { UnsubscribeSchema } from "../validators";

type PostBody = z.infer<typeof UnsubscribeSchema>;

export async function POST(req: MedusaRequest<PostBody>, res: MedusaResponse) {
  const { token } = req.validatedBody;

  await unsubscribeFromNewsletterWorkflow(req.scope).run({
    input: { token },
  });

  res.json({ success: true });
}
