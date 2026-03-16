import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { resolveAdminUrl, resolveStorefrontUrl } from "./_helpers/resolve-urls"

type PasswordResetPayload = {
  entity_id: string  // This IS the email address (renamed from `email` after v2.0.7)
  actor_type: string
  token: string
}

export default async function passwordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetPayload>) {
  const logger = container.resolve("logger")

  try {
    const email = data.entity_id?.trim()
    const token = data.token?.trim()
    const actorType = data.actor_type

    if (!email || !token) {
      logger.warn("Password reset payload missing email or token, skipping notification")
      return
    }

    if (actorType !== "customer" && actorType !== "user") {
      logger.warn(`Password reset payload has unsupported actor type "${String(actorType)}", skipping notification`)
      return
    }

    // Build reset URL based on actor type
    const params = `token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
    let resetUrl: string

    if (actorType === "customer") {
      const storefrontUrl = resolveStorefrontUrl()
      if (!storefrontUrl) {
        logger.error("STOREFRONT_URL is not configured, skipping password reset email")
        return
      }
      resetUrl = `${storefrontUrl}/reset-password?${params}`
    } else {
      const adminUrl = resolveAdminUrl(container)
      if (!adminUrl) {
        logger.error("admin.backendUrl is not configured, skipping password reset email")
        return
      }
      resetUrl = `${adminUrl}/reset-password?${params}`
    }

    const notificationService = container.resolve(Modules.NOTIFICATION)

    await notificationService.createNotifications({
      to: email,
      channel: "email",
      template: "password-reset",
      data: {
        subject: actorType === "customer"
          ? "Reset Your Password"
          : "Reset Your Admin Password",
        resetUrl,
        email,
        actorType,
      },
    })

    logger.info(`Password reset email sent (${actorType})`)
  } catch (error) {
    logger.error(
      `Failed to send password reset email (${data.actor_type})`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
