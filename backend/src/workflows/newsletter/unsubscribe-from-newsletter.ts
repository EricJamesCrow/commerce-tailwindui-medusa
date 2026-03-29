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

type UnsubscribeInput = {
  subscriber_id: string;
};

const unsubscribeStep = createStep(
  "unsubscribe-newsletter",
  async (input: { subscriber_id: string }, { container }) => {
    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE);

    const [subscriber] = await newsletterService.listSubscribers(
      { id: input.subscriber_id },
      { take: 1 },
    );

    if (!subscriber) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Subscriber not found",
      );
    }

    if (subscriber.status === "unsubscribed") {
      return new StepResponse({ subscriber, wasChanged: false }, null);
    }

    const previousStatus = subscriber.status;
    const previousNonce = subscriber.unsubscribe_nonce;

    const updated = await newsletterService.updateSubscribers({
      id: subscriber.id,
      status: "unsubscribed",
      unsubscribe_nonce: null,
      unsubscribed_at: new Date(),
    });

    return new StepResponse(
      { subscriber: updated, wasChanged: true },
      {
        id: subscriber.id,
        previousStatus,
        previousNonce,
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
      unsubscribe_nonce: compensationData.previousNonce,
      unsubscribed_at: null,
    });
  },
);

export const unsubscribeFromNewsletterWorkflow = createWorkflow(
  "unsubscribe-from-newsletter",
  function (input: UnsubscribeInput) {
    const result = unsubscribeStep({ subscriber_id: input.subscriber_id });

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
