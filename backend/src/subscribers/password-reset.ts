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
    const email = data.entity_id
    const actorType = data.actor_type as "customer" | "user"
    const token = data.token

    // Build reset URL based on actor type
    let resetUrl: string

    if (actorType === "customer") {
      const storefrontUrl = (process.env.STOREFRONT_URL || "http://localhost:3000").replace(/\/$/, "")
      resetUrl = `${storefrontUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
    } else {
      // Admin user — resolve URL from configModule (canonical source)
      const configModule = container.resolve("configModule")
      const rawBackendUrl = configModule.admin?.backendUrl
      const backendUrl = ((rawBackendUrl && rawBackendUrl !== "/")
        ? rawBackendUrl
        : "http://localhost:9000").replace(/\/$/, "")
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

    logger.info(`Password reset email sent to ${email} (${actorType})`)
  } catch (error) {
    logger.error(
      `Failed to send password reset email for ${data.entity_id}`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
