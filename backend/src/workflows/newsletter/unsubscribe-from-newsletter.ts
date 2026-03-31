import {
  createWorkflow,
  createStep,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { emitEventStep } from "@medusajs/medusa/core-flows";
import { NEWSLETTER_MODULE } from "../../modules/newsletter";
import NewsletterModuleService from "../../modules/newsletter/service";
import { isUnsubscribeTokenExpired } from "../../utils/newsletter-token";

type UnsubscribeInput = {
  token: string;
};

const unsubscribeStep = createStep(
  "unsubscribe-newsletter",
  async (input: { token: string }, { container }) => {
    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE);

    const [subscriber] = await newsletterService.listSubscribers(
      { unsubscribe_token: input.token },
      { take: 1 },
    );

    if (!subscriber) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid or expired unsubscribe token",
      );
    }

    if (isUnsubscribeTokenExpired(subscriber.unsubscribe_token_expires_at)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid or expired unsubscribe token",
      );
    }

    const previousStatus = subscriber.status;
    const previousUnsubscribedAt = subscriber.unsubscribed_at;
    const previousToken = subscriber.unsubscribe_token;
    const previousTokenExpiresAt = subscriber.unsubscribe_token_expires_at;

    const updated = await newsletterService.updateSubscribers({
      id: subscriber.id,
      status: "unsubscribed",
      unsubscribe_token: null,
      unsubscribe_token_expires_at: null,
      unsubscribed_at: new Date(),
    });

    return new StepResponse(
      { subscriber: updated, wasChanged: true },
      {
        id: subscriber.id,
        previousStatus,
        previousUnsubscribedAt,
        previousToken,
        previousTokenExpiresAt,
      },
    );
  },
  async (compensationData, { container }) => {
    if (!compensationData) return;

    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE);

    await newsletterService.updateSubscribers({
      id: compensationData.id,
      status: compensationData.previousStatus,
      unsubscribe_token: compensationData.previousToken,
      unsubscribe_token_expires_at: compensationData.previousTokenExpiresAt,
      unsubscribed_at: compensationData.previousUnsubscribedAt,
    });
  },
);

export const unsubscribeFromNewsletterWorkflow = createWorkflow(
  "unsubscribe-from-newsletter",
  function (input: UnsubscribeInput) {
    const result = unsubscribeStep({ token: input.token });

    when(result, (data) => data.wasChanged).then(() => {
      const eventData = transform({ result }, (data) => ({
        eventName: "newsletter.unsubscribed" as const,
        data: {
          id: data.result.subscriber.id,
        },
      }));

      emitEventStep(eventData);
    });

    const subscriber = transform({ result }, (data) => data.result.subscriber);

    return new WorkflowResponse(subscriber);
  },
);
