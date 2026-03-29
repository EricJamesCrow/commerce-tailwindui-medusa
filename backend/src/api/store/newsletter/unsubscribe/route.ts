import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import { NEWSLETTER_MODULE } from "../../../../modules/newsletter";
import type NewsletterModuleService from "../../../../modules/newsletter/service";
import { unsubscribeFromNewsletterWorkflow } from "../../../../workflows/newsletter/unsubscribe-from-newsletter";
import { UnsubscribeSchema } from "../validators";

type PostBody = z.infer<typeof UnsubscribeSchema>;

export async function POST(req: MedusaRequest<PostBody>, res: MedusaResponse) {
  const { token } = req.validatedBody;

  const newsletterService: NewsletterModuleService =
    req.scope.resolve(NEWSLETTER_MODULE);
  const [subscriber] = await newsletterService.listSubscribers(
    { unsubscribe_nonce: token },
    { take: 1 },
  );

  if (!subscriber) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid or expired unsubscribe token",
    );
  }

  await unsubscribeFromNewsletterWorkflow(req.scope).run({
    input: { subscriber_id: subscriber.id },
  });

  res.json({ success: true });
}
