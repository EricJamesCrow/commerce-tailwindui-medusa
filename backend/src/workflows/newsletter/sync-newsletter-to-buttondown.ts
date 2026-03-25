import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { NEWSLETTER_MODULE } from "../../modules/newsletter"
import NewsletterModuleService from "../../modules/newsletter/service"

type SyncInput = {
  email: string
  subscriber_id: string
}

const syncToButtondownStep = createStep(
  "sync-newsletter-to-buttondown",
  async (input: SyncInput, { container }) => {
    const apiKey = process.env.BUTTONDOWN_API_KEY

    if (!apiKey) {
      return new StepResponse({ skipped: true })
    }

    const logger = container.resolve("logger")

    const response = await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        type: "regular",
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()

      // Buttondown returns 400 if subscriber already exists — treat as non-fatal
      if (response.status === 400 && errorBody.includes("already")) {
        logger.info(
          `[newsletter] Subscriber ${input.subscriber_id} already exists in Buttondown, skipping`
        )
        return new StepResponse({ skipped: true })
      }

      logger.warn(
        `[newsletter] Failed to sync subscriber ${input.subscriber_id} to Buttondown: ${errorBody}`
      )
      throw new Error(
        `Failed to sync subscriber to Buttondown: ${errorBody}`
      )
    }

    const data = await response.json()

    if (data?.id) {
      const newsletterService: NewsletterModuleService =
        container.resolve(NEWSLETTER_MODULE)

      await newsletterService.updateSubscribers({
        id: input.subscriber_id,
        buttondown_subscriber_id: data.id,
      })
    }

    return new StepResponse({ skipped: false, subscriberId: data?.id })
  }
)

export const syncNewsletterToButtondownWorkflow = createWorkflow(
  "sync-newsletter-to-buttondown",
  function (input: SyncInput) {
    const result = syncToButtondownStep(input)
    return new WorkflowResponse(result)
  }
)
