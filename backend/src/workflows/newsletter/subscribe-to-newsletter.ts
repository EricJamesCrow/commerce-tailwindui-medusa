import {
  createWorkflow,
  createStep,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { emitEventStep } from "@medusajs/medusa/core-flows";
import { NEWSLETTER_MODULE } from "../../modules/newsletter";
import NewsletterModuleService from "../../modules/newsletter/service";
import {
  isUnsubscribeTokenExpired,
  issueUnsubscribeToken,
} from "../../utils/newsletter-token";

type SubscribeInput = {
  email: string;
  source: "footer" | "checkout" | "account" | "import";
  customer_id?: string;
};

const upsertSubscriberStep = createStep(
  "upsert-newsletter-subscriber",
  async (
    input: {
      email: string;
      source: "footer" | "checkout" | "account" | "import";
      customer_id?: string;
    },
    { container },
  ) => {
    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE);

    const email = input.email.toLowerCase();

    const [existing] = await newsletterService.listSubscribers(
      { email },
      { take: 1 },
    );

    if (existing) {
      let needsUpdate = false;
      const updates: Record<string, unknown> = {};

      if (input.customer_id && !existing.customer_id) {
        updates.customer_id = input.customer_id;
        needsUpdate = true;
      }

      const wasUnsubscribed = existing.status === "unsubscribed";
      if (wasUnsubscribed) {
        updates.status = "active";
        updates.unsubscribed_at = null;
        needsUpdate = true;
      }

      if (
        wasUnsubscribed ||
        !existing.unsubscribe_token ||
        isUnsubscribeTokenExpired(existing.unsubscribe_token_expires_at)
      ) {
        const { token, expiresAt } = issueUnsubscribeToken();
        updates.unsubscribe_token = token;
        updates.unsubscribe_token_expires_at = expiresAt;
        needsUpdate = true;
      }

      if (needsUpdate) {
        const updated = await newsletterService.updateSubscribers({
          id: existing.id,
          ...updates,
        });
        return new StepResponse(
          {
            subscriber: updated,
            isNewSubscriber: false,
            wasReactivated: wasUnsubscribed,
          },
          existing.id,
        );
      }

      return new StepResponse(
        { subscriber: existing, isNewSubscriber: false, wasReactivated: false },
        existing.id,
      );
    }

    const { token, expiresAt } = issueUnsubscribeToken();
    const subscriber = await newsletterService.createSubscribers({
      email,
      source: input.source,
      customer_id: input.customer_id || null,
      status: "active",
      unsubscribe_token: token,
      unsubscribe_token_expires_at: expiresAt,
    });

    return new StepResponse(
      { subscriber, isNewSubscriber: true, wasReactivated: false },
      subscriber.id,
    );
  },
);

export const subscribeToNewsletterWorkflow = createWorkflow(
  "subscribe-to-newsletter",
  function (input: SubscribeInput) {
    const result = upsertSubscriberStep({
      email: input.email,
      source: input.source,
      customer_id: input.customer_id,
    });

    const eventData = transform({ result }, (data) => ({
      eventName: "newsletter.subscribed" as const,
      data: {
        id: data.result.subscriber.id,
        email: data.result.subscriber.email,
        isNewSubscriber: data.result.isNewSubscriber,
        wasReactivated: data.result.wasReactivated,
      },
    }));

    emitEventStep(eventData);

    return new WorkflowResponse(result);
  },
);
