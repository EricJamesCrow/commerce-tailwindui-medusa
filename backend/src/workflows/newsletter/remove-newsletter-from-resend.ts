import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { Resend } from "resend";
import { NEWSLETTER_MODULE } from "../../modules/newsletter";
import NewsletterModuleService from "../../modules/newsletter/service";

type RemoveInput = {
  subscriber_id: string;
};

const removeFromResendStep = createStep(
  "remove-newsletter-from-resend",
  async (input: RemoveInput, { container }) => {
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    const apiKey = process.env.RESEND_API_KEY;

    if (!audienceId || !apiKey) {
      return new StepResponse({ skipped: true });
    }

    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE);

    const [subscriber] = await newsletterService.listSubscribers(
      { id: input.subscriber_id },
      { take: 1 },
    );

    if (!subscriber?.resend_contact_id) {
      return new StepResponse({ skipped: true });
    }

    const resend = new Resend(apiKey);
    const logger = container.resolve("logger");

    const { error } = await resend.contacts.remove({
      id: subscriber.resend_contact_id,
      audienceId,
    });

    if (error) {
      logger.warn(
        `[newsletter] Failed to remove subscriber ${input.subscriber_id} from Resend Audience: ${error.message}`,
      );
      throw new Error(
        `Failed to remove subscriber ${input.subscriber_id} from Resend: ${error.message}`,
      );
    }

    await newsletterService.updateSubscribers({
      id: input.subscriber_id,
      resend_contact_id: null,
    });

    return new StepResponse({ skipped: false });
  },
);

export const removeNewsletterFromResendWorkflow = createWorkflow(
  "remove-newsletter-from-resend",
  function (input: RemoveInput) {
    const result = removeFromResendStep(input);
    return new WorkflowResponse(result);
  },
);
