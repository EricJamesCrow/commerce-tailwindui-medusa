import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendAdminOrderAlertWorkflow } from "../workflows/notifications/send-admin-order-alert"
import { resolveAdminUrl } from "./_helpers/resolve-urls"

export default async function adminOrderAlertHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  const adminEmails = (process.env.ADMIN_ORDER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (adminEmails.length === 0) {
    logger.debug(
      "ADMIN_ORDER_EMAILS not configured, skipping admin order alert"
    )
    return
  }

  const adminUrl = resolveAdminUrl(container) || "http://localhost:9000/app"

  try {
    await sendAdminOrderAlertWorkflow(container).run({
      input: { orderId: data.id, adminEmails, adminUrl },
    })
    logger.info(
      `Admin order alert sent for order ${data.id} to ${adminEmails.length} recipient(s)`
    )
  } catch (error) {
    logger.error(
      `Failed to send admin order alert for order ${data.id}`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
