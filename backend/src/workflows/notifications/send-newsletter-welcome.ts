import {
  createWorkflow,
  createStep,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { sendNotificationsStep } from "@medusajs/medusa/core-flows";
import { EmailTemplates } from "../../modules/resend/templates/template-registry";
import { NEWSLETTER_MODULE } from "../../modules/newsletter";
import NewsletterModuleService from "../../modules/newsletter/service";
import { resolveStorefrontUrl } from "../../subscribers/_helpers/resolve-urls";
import { issueUnsubscribeToken } from "../../utils/newsletter-token";

type SendWelcomeInput = {
  email: string;
  subscriber_id: string;
  template?: string;
};

const issueUnsubscribeCredentialStep = createStep(
  "issue-newsletter-unsubscribe-credential",
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

    const { token, expiresAt } = issueUnsubscribeToken();

    await newsletterService.updateSubscribers({
      id: subscriber.id,
      unsubscribe_token: token,
      unsubscribe_token_expires_at: expiresAt,
    });

    return new StepResponse(
      { token },
      {
        id: subscriber.id,
        previousToken: subscriber.unsubscribe_token,
        previousTokenExpiresAt: subscriber.unsubscribe_token_expires_at,
      },
    );
  },
  async (compensationData, { container }) => {
    if (!compensationData) {
      return;
    }

    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE);

    await newsletterService.updateSubscribers({
      id: compensationData.id,
      unsubscribe_token: compensationData.previousToken,
      unsubscribe_token_expires_at: compensationData.previousTokenExpiresAt,
    });
  },
);

const buildWelcomeNotificationStep = createStep(
  "build-newsletter-welcome-notification",
  async (
    input: SendWelcomeInput & {
      token: string;
    },
  ) => {
    const storefrontUrl = resolveStorefrontUrl();
    if (!storefrontUrl) {
      return new StepResponse(null);
    }

    const unsubscribeUrl = `${storefrontUrl}/newsletter/unsubscribe?token=${input.token}`;

    return new StepResponse({
      to: input.email,
      channel: "email" as const,
      template: input.template || EmailTemplates.NEWSLETTER_WELCOME,
      data: {
        email: input.email,
        unsubscribeUrl,
      },
      trigger_type: "newsletter.subscribed",
      resource_id: input.subscriber_id,
      resource_type: "newsletter_subscriber",
    });
  },
);

export const sendNewsletterWelcomeWorkflow = createWorkflow(
  "send-newsletter-welcome",
  function (input: SendWelcomeInput) {
    const credential = issueUnsubscribeCredentialStep({
      subscriber_id: input.subscriber_id,
    });

    const notificationInput = transform({ credential, input }, (data) => ({
      email: data.input.email,
      subscriber_id: data.input.subscriber_id,
      template: data.input.template,
      token: data.credential.token,
    }));

    const notification = buildWelcomeNotificationStep(notificationInput);

    const notifications = transform({ notification }, (data) => {
      if (!data.notification) return [];
      return [data.notification];
    });

    sendNotificationsStep(notifications);

    const result = transform({ notification }, (data) => ({
      sent: data.notification !== null,
    }));

    return new WorkflowResponse(result);
  },
);
