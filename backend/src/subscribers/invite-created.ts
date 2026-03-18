import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendInviteEmailWorkflow } from "../workflows/notifications/send-invite-email"

export default async function inviteCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    await sendInviteEmailWorkflow(container).run({
      input: { id: data.id },
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
