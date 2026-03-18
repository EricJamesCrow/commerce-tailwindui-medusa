import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendWelcomeEmailWorkflow } from "../workflows/notifications/send-welcome-email"

export default async function customerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    await sendWelcomeEmailWorkflow(container).run({
      input: { id: data.id },
    })
    logger.info(`Welcome email sent (customer ${data.id})`)
  } catch (error) {
    logger.error(
      `Failed to send welcome email for customer ${data.id}`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
