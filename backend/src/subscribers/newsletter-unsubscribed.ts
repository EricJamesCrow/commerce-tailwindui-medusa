import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { removeNewsletterFromResendWorkflow } from "../workflows/newsletter/remove-newsletter-from-resend"

type NewsletterUnsubscribedData = {
  id: string
  email: string
}

export default async function newsletterUnsubscribedHandler({
  event: { data },
  container,
}: SubscriberArgs<NewsletterUnsubscribedData>) {
  const logger = container.resolve("logger")

  try {
    await removeNewsletterFromResendWorkflow(container).run({
      input: { email: data.email, subscriber_id: data.id },
    })
    logger.info(
      `[newsletter] Removed ${data.email} from Resend Audience`
    )
  } catch (error) {
    logger.warn(
      `[newsletter] Failed to remove ${data.email} from Resend: ${error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "newsletter.unsubscribed",
}
