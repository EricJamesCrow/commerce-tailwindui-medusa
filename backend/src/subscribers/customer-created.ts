import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import * as Sentry from "@sentry/node";
import { sendWelcomeEmailWorkflow } from "../workflows/notifications/send-welcome-email";
import { trackCustomerCreatedWorkflow } from "../workflows/analytics/track-customer-created";

export default async function customerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");

  try {
    await sendWelcomeEmailWorkflow(container).run({
      input: { id: data.id },
    });
    logger.info(`Welcome email sent (customer ${data.id})`);
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        subscriber: "customer_created",
        step: "welcome_email",
        customer_id: data.id,
      },
    });
    logger.error(`Failed to send welcome email for customer ${data.id}`, error);
  }

  try {
    await trackCustomerCreatedWorkflow(container).run({
      input: { customer_id: data.id },
    });
  } catch (error) {
    logger.warn(
      `[analytics] Failed to track customer_created for ${data.id}: ${error}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
};
