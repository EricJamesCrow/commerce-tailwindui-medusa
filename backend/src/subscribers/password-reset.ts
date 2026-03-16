import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

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
    let resetUrl: string

    if (actorType === "customer") {
      const rawStorefrontUrl = process.env.STOREFRONT_URL
      if (!rawStorefrontUrl) {
        logger.error("STOREFRONT_URL is not configured, skipping password reset email")
        return
      }
      const storefrontUrl = rawStorefrontUrl.replace(/\/$/, "")
      resetUrl = `${storefrontUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
    } else {
      // Admin user — resolve URL from configModule (canonical source)
      const configModule = container.resolve("configModule")
      const rawBackendUrl = configModule.admin?.backendUrl
      if (!rawBackendUrl || rawBackendUrl === "/") {
        logger.error("admin.backendUrl is not configured, skipping password reset email")
        return
      }
      const backendUrl = rawBackendUrl.replace(/\/$/, "")
      const adminPath = configModule.admin?.path || "/app"
      resetUrl = `${backendUrl}${adminPath}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
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
