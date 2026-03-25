import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import * as Sentry from "@sentry/node";
import { sendOrderCanceledWorkflow } from "../workflows/notifications/send-order-canceled";
import { trackOrderCanceledWorkflow } from "../workflows/analytics/track-order-canceled";

export default async function orderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");

  try {
    await sendOrderCanceledWorkflow(container).run({
      input: { orderId: data.id },
    });
    logger.info(`Order canceled email sent for order ${data.id}`);
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        subscriber: "order_canceled",
        step: "send_email",
        order_id: data.id,
      },
    });
    logger.error(
      `Failed to send order canceled email for order ${data.id}`,
      error,
    );
  }

  try {
    await trackOrderCanceledWorkflow(container).run({
      input: { order_id: data.id },
    });
  } catch (error) {
    logger.warn(
      `[analytics] Failed to track order_canceled for ${data.id}: ${error}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
};
