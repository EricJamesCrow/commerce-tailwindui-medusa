import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { syncNewsletterToResendWorkflow } from "../workflows/newsletter/sync-newsletter-to-resend"
import { sendNewsletterWelcomeWorkflow } from "../workflows/notifications/send-newsletter-welcome"

type NewsletterSubscribedData = {
  id: string
  email: string
  isNewSubscriber: boolean
}

export default async function newsletterSubscribedHandler({
  event: { data },
  container,
}: SubscriberArgs<NewsletterSubscribedData>) {
  const logger = container.resolve("logger")

  try {
    await syncNewsletterToResendWorkflow(container).run({
      input: { email: data.email, subscriber_id: data.id },
    })
    logger.info(`[newsletter] Synced ${data.email} to Resend Audience`)
  } catch (error) {
    logger.warn(
      `[newsletter] Failed to sync ${data.email} to Resend: ${error}`
    )
  }

  if (data.isNewSubscriber) {
    try {
      await sendNewsletterWelcomeWorkflow(container).run({
        input: { email: data.email, subscriber_id: data.id },
      })
      logger.info(`[newsletter] Welcome email sent to ${data.email}`)
    } catch (error) {
      logger.warn(
        `[newsletter] Failed to send welcome email to ${data.email}: ${error}`
      )
    }
  }
}

export const config: SubscriberConfig = {
  event: "newsletter.subscribed",
}
