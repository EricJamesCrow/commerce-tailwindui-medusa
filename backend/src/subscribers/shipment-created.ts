import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendShippingConfirmationWorkflow } from "../workflows/notifications/send-shipping-confirmation"

type ShipmentCreatedPayload = {
  id: string
  no_notification: boolean
}

export default async function shipmentCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<ShipmentCreatedPayload>) {
  const logger = container.resolve("logger")

  if (data.no_notification) {
    logger.debug(`Shipment ${data.id}: no_notification=true, skipping email`)
    return
  }

  try {
    await sendShippingConfirmationWorkflow(container).run({
      input: { fulfillmentId: data.id },
    })
    logger.info(`Shipping confirmation email sent for fulfillment ${data.id}`)
  } catch (error) {
    logger.error(
      `Failed to send shipping confirmation for fulfillment ${data.id}`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
