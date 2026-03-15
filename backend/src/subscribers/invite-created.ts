import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { defaultEmailConfig } from "../modules/resend/templates/_config/email-config"

export default async function inviteCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    // Fetch invite record — always fresh (invite.resent regenerates the token)
    const userModuleService = container.resolve(Modules.USER)
    const invite = await userModuleService.retrieveInvite(data.id)

    if (!invite.email) {
      logger.warn(`Invite ${data.id} has no email address, skipping notification`)
      return
    }

    if (!invite.token) {
      logger.warn(`Invite ${data.id} has no token, skipping notification`)
      return
    }

    // Build admin invite URL from configModule (canonical source for admin URL)
    const configModule = container.resolve("configModule")
    const rawBackendUrl = configModule.admin?.backendUrl
    const backendUrl = ((rawBackendUrl && rawBackendUrl !== "/")
      ? rawBackendUrl
      : "http://localhost:9000").replace(/\/$/, "")
    const adminPath = configModule.admin?.path || "/app"
    const inviteUrl = `${backendUrl}${adminPath}/invite?token=${encodeURIComponent(invite.token)}`

    const storeName = defaultEmailConfig.companyName
    const notificationService = container.resolve(Modules.NOTIFICATION)

    await notificationService.createNotifications({
      to: invite.email,
      channel: "email",
      template: "invite-user",
      data: {
        subject: `You've been invited to join ${storeName}`,
        inviteUrl,
        storeName,
      },
    })

    logger.info(`Invite email sent to ${invite.email} (invite ${data.id})`)
  } catch (error) {
    logger.error(
      `Failed to send invite email for invite ${data.id}`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: ["invite.created", "invite.resent"],
}
