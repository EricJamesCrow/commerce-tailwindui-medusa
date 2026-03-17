import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import {
  useQueryGraphStep,
  sendNotificationsStep,
} from "@medusajs/medusa/core-flows"
import { formatOrderForEmailStep } from "../steps/format-order-for-email"

type SendShippingConfirmationInput = {
  fulfillmentId: string
}

export const sendShippingConfirmationWorkflow = createWorkflow(
  "send-shipping-confirmation",
  function (input: SendShippingConfirmationInput) {
    const { data: fulfillments } = useQueryGraphStep({
      entity: "fulfillment",
      fields: [
        "id",
        "tracking_numbers",
        "labels.*",
        "order.id",
        "order.display_id",
        "order.email",
        "order.created_at",
        "order.currency_code",
        "order.items.*",
        "order.shipping_address.*",
        "order.total",
        "order.subtotal",
        "order.item_total",
        "order.item_subtotal",
        "order.shipping_total",
        "order.tax_total",
      ],
      filters: { id: input.fulfillmentId },
    })

    const orderAndTracking = transform(
      { fulfillments },
      ({ fulfillments: result }) => {
        const fulfillment = result[0]
        if (!fulfillment) {
          throw new MedusaError(
            MedusaError.Types.NOT_FOUND,
            "Fulfillment not found"
          )
        }

        const order = (fulfillment as any).order
        if (!order?.email) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Order has no email address, cannot send shipping confirmation"
          )
        }

        return {
          order,
          trackingNumbers: (fulfillment as any).tracking_numbers || [],
        }
      }
    )

    const formatted = formatOrderForEmailStep({
      order: orderAndTracking.order,
    })

    const notifications = transform(
      { formatted, orderAndTracking },
      ({ formatted: data, orderAndTracking: ot }) => {
        const storefrontUrl =
          process.env.STOREFRONT_URL || "http://localhost:3000"

        const trackingNumber = ot.trackingNumbers[0] || null

        return [
          {
            to: data.email,
            channel: "email" as const,
            template: "shipping-confirmation",
            data: {
              subject: `Your order #${data.orderNumber} has shipped`,
              customerName: data.customerName,
              orderNumber: data.orderNumber,
              orderDate: data.orderDate,
              items: data.items,
              subtotal: data.subtotal,
              shipping: data.shipping,
              tax: data.tax,
              discount: data.discount,
              total: data.total,
              shippingAddress: data.shippingAddress,
              trackingNumber,
              trackingUrl: trackingNumber
                ? `${storefrontUrl}/account/orders/${data.orderId}`
                : null,
              orderStatusUrl: `${storefrontUrl}/account/orders/${data.orderId}`,
            },
            trigger_type: "shipment.created",
            resource_id: data.orderId,
            resource_type: "order",
          },
        ]
      }
    )

    sendNotificationsStep(notifications)

    return new WorkflowResponse({
      fulfillmentId: input.fulfillmentId,
    })
  }
)
