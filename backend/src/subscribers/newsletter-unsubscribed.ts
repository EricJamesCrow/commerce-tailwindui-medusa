import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import * as Sentry from "@sentry/node";
import { removeNewsletterFromResendWorkflow } from "../workflows/newsletter/remove-newsletter-from-resend";

type NewsletterUnsubscribedData = {
  id: string;
};

export default async function newsletterUnsubscribedHandler({
  event: { data },
  container,
}: SubscriberArgs<NewsletterUnsubscribedData>) {
  const logger = container.resolve("logger");

  try {
    await removeNewsletterFromResendWorkflow(container).run({
      input: { subscriber_id: data.id },
    });
    logger.info(
      `[newsletter] Removed subscriber ${data.id} from Resend Audience`,
    );
  } catch (error) {
    Sentry.captureException(error, {
      tags: { subscriber: "newsletter_unsubscribed" },
    });
    logger.warn(
      `[newsletter] Failed to remove subscriber ${data.id} from Resend: ${error}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "newsletter.unsubscribed",
};
