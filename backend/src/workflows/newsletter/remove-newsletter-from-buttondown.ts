import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { NEWSLETTER_MODULE } from "../../modules/newsletter"
import NewsletterModuleService from "../../modules/newsletter/service"

type RemoveInput = {
  subscriber_id: string
}

const removeFromButtondownStep = createStep(
  "remove-newsletter-from-buttondown",
  async (input: RemoveInput, { container }) => {
    const apiKey = process.env.BUTTONDOWN_API_KEY

    if (!apiKey) {
      return new StepResponse({ skipped: true })
    }

    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE)

    const [subscriber] = await newsletterService.listSubscribers(
      { id: input.subscriber_id },
      { take: 1 }
    )

    if (!subscriber?.buttondown_subscriber_id) {
      return new StepResponse({ skipped: true })
    }

    const logger = container.resolve("logger")

    const response = await fetch(
      `https://api.buttondown.com/v1/subscribers/${subscriber.buttondown_subscriber_id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      }
    )

    if (!response.ok && response.status !== 404) {
      const errorBody = await response.text()
      logger.warn(
        `[newsletter] Failed to remove subscriber ${input.subscriber_id} from Buttondown: ${errorBody}`
      )
      throw new Error(
        `Failed to remove subscriber ${input.subscriber_id} from Buttondown: ${errorBody}`
      )
    }

    await newsletterService.updateSubscribers({
      id: input.subscriber_id,
      buttondown_subscriber_id: null,
    })

    return new StepResponse({ skipped: false })
  }
)

export const removeNewsletterFromButtondownWorkflow = createWorkflow(
  "remove-newsletter-from-buttondown",
  function (input: RemoveInput) {
    const result = removeFromButtondownStep(input)
    return new WorkflowResponse(result)
  }
)
