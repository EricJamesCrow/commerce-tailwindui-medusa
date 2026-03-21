import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { trackAnalyticsEventStep } from "../steps/track-analytics-event"

type TrackOrderCanceledInput = {
  order_id: string
}

export const trackOrderCanceledWorkflow = createWorkflow(
  "track-order-canceled",
  function (input: TrackOrderCanceledInput) {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: ["id", "customer_id", "email", "total", "currency_code"],
      filters: { id: input.order_id },
    })

    const trackingInput = transform({ orders }, ({ orders: result }) => {
      const order = result[0]
      if (!order) return null

      return {
        event: "order_canceled",
        actor_id: order.customer_id ?? null,
        actor_fallback: order.email ?? null,
        properties: {
          order_id: order.id,
          total: order.total,
          currency_code: order.currency_code,
          customer_id: order.customer_id ?? null,
        },
      }
    })

    trackAnalyticsEventStep(trackingInput)

    return new WorkflowResponse({})
  }
)
