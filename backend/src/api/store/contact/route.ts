import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import * as Sentry from "@sentry/node";
import { sendContactFormMessageWorkflow } from "../../../workflows/notifications/send-contact-form-message";
import type { PostStoreContactSchema } from "./validators";

export async function POST(
  req: MedusaRequest<PostStoreContactSchema>,
  res: MedusaResponse,
) {
  const { company: _company, ...input } = req.validatedBody;

  try {
    await sendContactFormMessageWorkflow(req.scope).run({
      input,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        route: "store_contact",
        step: "send_contact_form_message",
      },
      extra: {
        subject_length: input.subject.length,
        message_length: input.message.length,
      },
    });

    res.status(500).json({
      message: "We couldn't send your message. Please try again later.",
      type: "contact_send_failed",
    });
  }
}
