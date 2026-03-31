import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { NEWSLETTER_MODULE } from "../../modules/newsletter";
import NewsletterModuleService from "../../modules/newsletter/service";

type Input = {
  email?: string | null;
};

export const shouldSendOrderUpdateEmailStep = createStep(
  "should-send-order-update-email",
  async (input: Input, { container }) => {
    const normalizedEmail = input.email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return new StepResponse(true);
    }

    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE);
    const [subscriber] = await newsletterService.listSubscribers(
      { email: normalizedEmail },
      { take: 1 },
    );

    return new StepResponse(subscriber?.order_updates_enabled ?? true);
  },
);
