import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendOrderCanceledWorkflow } from "../workflows/notifications/send-order-canceled"

export default async function orderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    await sendOrderCanceledWorkflow(container).run({
      input: { orderId: data.id },
    })
    logger.info(`Order canceled email sent for order ${data.id}`)
  } catch (error) {
    logger.error(
      `Failed to send order canceled email for order ${data.id}`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
