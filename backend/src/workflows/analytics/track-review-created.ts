import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review"
import ProductReviewModuleService from "../../modules/product-review/service"
import { trackAnalyticsEventStep } from "../steps/track-analytics-event"

type TrackReviewCreatedInput = {
  review_id: string
  product_id: string
}

const fetchReviewStep = createStep(
  "fetch-review-for-analytics",
  async (
    input: TrackReviewCreatedInput,
    { container }
  ): Promise<StepResponse<{
    event: string
    actor_id: string | null
    actor_fallback: null
    properties: Record<string, unknown>
  } | null>> => {
    const reviewService: ProductReviewModuleService = container.resolve(PRODUCT_REVIEW_MODULE)

    try {
      const review = await reviewService.retrieveReview(input.review_id, {
        relations: ["images"],
      })

      return new StepResponse({
        event: "review_created",
        actor_id: review.customer_id ?? null,
        actor_fallback: null,
        properties: {
          product_id: input.product_id,
          rating: review.rating,
          has_images: (review.images?.length ?? 0) > 0,
        },
      })
    } catch {
      return new StepResponse(null)
    }
  }
)

export const trackReviewCreatedWorkflow = createWorkflow(
  "track-review-created",
  function (input: TrackReviewCreatedInput) {
    const trackingInput = fetchReviewStep(input)

    trackAnalyticsEventStep(trackingInput)

    return new WorkflowResponse({})
  }
)
