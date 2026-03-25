import {
  createWorkflow,
  createStep,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { sendNotificationsStep } from "@medusajs/medusa/core-flows";
import { EmailTemplates } from "../../modules/resend/templates/template-registry";
import { signUnsubscribeToken } from "../../utils/newsletter-token";
import { resolveStorefrontUrl } from "../../subscribers/_helpers/resolve-urls";

type SendWelcomeInput = {
  email: string;
  subscriber_id: string;
  template?: string;
};

const buildWelcomeNotificationStep = createStep(
  "build-newsletter-welcome-notification",
  async (input: SendWelcomeInput) => {
    const storefrontUrl = resolveStorefrontUrl();
    if (!storefrontUrl) {
      return new StepResponse(null);
    }

    const token = signUnsubscribeToken(input.email);
    const unsubscribeUrl = `${storefrontUrl}/newsletter/unsubscribe?token=${token}`;

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
    const notification = buildWelcomeNotificationStep(input);

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
