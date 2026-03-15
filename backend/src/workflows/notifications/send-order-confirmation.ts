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

type SendOrderConfirmationInput = {
  id: string
}

export const sendOrderConfirmationWorkflow = createWorkflow(
  "send-order-confirmation",
  function (input: SendOrderConfirmationInput) {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "created_at",
        "currency_code",
        "items.*",
        "shipping_address.*",
        "billing_address.*",
        "total",
        "subtotal",
        "item_total",
        "item_subtotal",
        "shipping_total",
        "tax_total",
        "discount_total",
      ],
      filters: { id: input.id },
    })

    const order = transform({ orders }, ({ orders: result }) => {
      const o = result[0]
      if (!o?.email) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Order has no email address, cannot send confirmation"
        )
      }
      return o
    })

    const formatted = formatOrderForEmailStep({ order })

    const notifications = transform({ formatted }, ({ formatted: data }) => {
      const storefrontUrl =
        process.env.STOREFRONT_URL || "http://localhost:3000"

      return [
        {
          to: data.email,
          channel: "email" as const,
          template: "order-confirmation",
          data: {
            subject: `Order Confirmed - #${data.orderNumber}`,
            customerName: data.customerName,
            orderNumber: data.orderNumber,
            orderDate: data.orderDate,
            items: data.items,
            subtotal: data.subtotal,
            shipping: data.shipping,
            tax: data.tax,
            discount: data.discount,
            total: data.total,
            paymentMethod: data.paymentMethod,
            shippingAddress: data.shippingAddress,
            orderStatusUrl: `${storefrontUrl}/account/orders/${data.orderId}`,
          },
          trigger_type: "order.placed",
          resource_id: data.orderId,
          resource_type: "order",
        },
      ]
    })

    sendNotificationsStep(notifications)

    return new WorkflowResponse({
      orderId: input.id,
    })
  }
)
