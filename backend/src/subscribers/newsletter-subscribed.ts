import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import * as Sentry from "@sentry/node";
import { syncNewsletterToResendWorkflow } from "../workflows/newsletter/sync-newsletter-to-resend";
import { sendNewsletterWelcomeWorkflow } from "../workflows/notifications/send-newsletter-welcome";
import { EmailTemplates } from "../modules/resend/templates/template-registry";

type NewsletterSubscribedData = {
  id: string;
  email: string;
  isNewSubscriber: boolean;
  wasReactivated: boolean;
};

export default async function newsletterSubscribedHandler({
  event: { data },
  container,
}: SubscriberArgs<NewsletterSubscribedData>) {
  const logger = container.resolve("logger");

  try {
    await syncNewsletterToResendWorkflow(container).run({
      input: { email: data.email, subscriber_id: data.id },
    });
    logger.info(`[newsletter] Synced subscriber ${data.id} to Resend Audience`);
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        subscriber: "newsletter_subscribed",
        step: "resend_sync",
        subscriber_id: data.id,
      },
    });
    logger.warn(
      `[newsletter] Failed to sync subscriber ${data.id} to Resend: ${error}`,
    );
  }

  if (data.isNewSubscriber) {
    try {
      await sendNewsletterWelcomeWorkflow(container).run({
        input: { email: data.email, subscriber_id: data.id },
      });
      logger.info(`[newsletter] Welcome email sent to subscriber ${data.id}`);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          subscriber: "newsletter_subscribed",
          step: "welcome_email",
          subscriber_id: data.id,
        },
      });
      logger.warn(
        `[newsletter] Failed to send welcome email to subscriber ${data.id}: ${error}`,
      );
    }
  } else if (data.wasReactivated) {
    try {
      await sendNewsletterWelcomeWorkflow(container).run({
        input: {
          email: data.email,
          subscriber_id: data.id,
          template: EmailTemplates.NEWSLETTER_WELCOME_BACK,
        },
      });
      logger.info(
        `[newsletter] Welcome-back email sent to subscriber ${data.id}`,
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          subscriber: "newsletter_subscribed",
          step: "welcome_back_email",
          subscriber_id: data.id,
        },
      });
      logger.warn(
        `[newsletter] Failed to send welcome-back email to subscriber ${data.id}: ${error}`,
      );
    }
  }
}

export const config: SubscriberConfig = {
  event: "newsletter.subscribed",
};
