import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { defaultEmailConfig } from "../modules/resend/templates/_config/email-config"
import { resolveStorefrontUrl } from "./_helpers/resolve-urls"

export default async function customerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    const customerModuleService = container.resolve(Modules.CUSTOMER)
    const customer = await customerModuleService.retrieveCustomer(data.id)

    if (!customer.email) {
      logger.warn(`Customer ${data.id} has no email address, skipping welcome email`)
      return
    }

    const storefrontUrl = resolveStorefrontUrl()
    if (!storefrontUrl) {
      logger.error("STOREFRONT_URL is not configured, skipping welcome email")
      return
    }

    const customerName = [customer.first_name, customer.last_name]
      .filter(Boolean)
      .join(" ") || null

    const storeName = defaultEmailConfig.companyName
    const notificationService = container.resolve(Modules.NOTIFICATION)

    await notificationService.createNotifications({
      to: customer.email,
      channel: "email",
      template: "welcome",
      data: {
        subject: `Welcome to ${storeName}`,
        customerName,
        shopUrl: storefrontUrl,
        accountUrl: `${storefrontUrl}/account`,
        storeName,
      },
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
