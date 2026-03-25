import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import * as Sentry from "@sentry/node";
import { sendShippingConfirmationWorkflow } from "../workflows/notifications/send-shipping-confirmation";
import { trackShipmentCreatedWorkflow } from "../workflows/analytics/track-shipment-created";

type ShipmentCreatedPayload = {
  id: string;
  no_notification: boolean;
};

export default async function shipmentCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<ShipmentCreatedPayload>) {
  const logger = container.resolve("logger");

  // Analytics first — always track regardless of notification preference
  try {
    await trackShipmentCreatedWorkflow(container).run({
      input: { fulfillment_id: data.id },
    });
  } catch (error) {
    logger.warn(
      `[analytics] Failed to track shipment_created for ${data.id}: ${error}`,
    );
  }

  // Then handle notification
  if (data.no_notification) {
    logger.debug(`Shipment ${data.id}: no_notification=true, skipping email`);
    return;
  }

  try {
    await sendShippingConfirmationWorkflow(container).run({
      input: { fulfillmentId: data.id },
    });
    logger.info(`Shipping confirmation email sent for fulfillment ${data.id}`);
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        subscriber: "shipment_created",
        step: "send_email",
        fulfillment_id: data.id,
      },
    });
    logger.error(
      `Failed to send shipping confirmation for fulfillment ${data.id}`,
      error,
    );
  }
}

export const config: SubscriberConfig = {
  event: "shipment.created",
};
