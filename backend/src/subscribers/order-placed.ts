import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import * as Sentry from "@sentry/node";
import { sendOrderConfirmationWorkflow } from "../workflows/notifications/send-order-confirmation";
import { trackOrderPlacedWorkflow } from "../workflows/analytics/track-order-placed";

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");

  try {
    await sendOrderConfirmationWorkflow(container).run({
      input: { id: data.id },
    });
    logger.info(`Order confirmation email sent for order ${data.id}`);
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        subscriber: "order_placed",
        step: "send_email",
        order_id: data.id,
      },
    });
    logger.error(
      `Failed to send order confirmation email for order ${data.id}`,
      error,
    );
  }

  try {
    await trackOrderPlacedWorkflow(container).run({
      input: { order_id: data.id },
    });
  } catch (error) {
    logger.warn(
      `[analytics] Failed to track order_placed for ${data.id}: ${error}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
