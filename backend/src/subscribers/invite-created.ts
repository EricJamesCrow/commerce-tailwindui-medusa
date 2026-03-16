import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { defaultEmailConfig } from "../modules/resend/templates/_config/email-config"
import { resolveAdminUrl } from "./_helpers/resolve-urls"

export default async function inviteCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
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

    const adminUrl = resolveAdminUrl(container)
    if (!adminUrl) {
      logger.error("admin.backendUrl is not configured, skipping invite email")
      return
    }

    const inviteUrl = `${adminUrl}/invite?token=${encodeURIComponent(invite.token)}`
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

    logger.info(`Invite email sent (invite ${data.id})`)
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
