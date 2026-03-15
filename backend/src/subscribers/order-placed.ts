import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendOrderConfirmationWorkflow } from "../workflows/notifications/send-order-confirmation"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    await sendOrderConfirmationWorkflow(container).run({
      input: { id: data.id },
    })
    logger.info(`Order confirmation email sent for order ${data.id}`)
  } catch (error) {
    logger.error(
      `Failed to send order confirmation email for order ${data.id}`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
