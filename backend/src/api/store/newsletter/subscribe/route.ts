import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { subscribeToNewsletterWorkflow } from "../../../../workflows/newsletter/subscribe-to-newsletter";
import { SubscribeSchema } from "../validators";

type PostBody = z.infer<typeof SubscribeSchema>;

export async function POST(req: MedusaRequest<PostBody>, res: MedusaResponse) {
  const { company, email, source } = req.validatedBody;

  if (company?.trim()) {
    res.status(200).json({ success: true });
    return;
  }

  const customerId = (req as any).auth_context?.actor_id as string | undefined;

  const { result } = await subscribeToNewsletterWorkflow(req.scope).run({
    input: {
      email,
      source,
      customer_id: customerId,
    },
  });

  res.status(200).json({ success: true });
}
