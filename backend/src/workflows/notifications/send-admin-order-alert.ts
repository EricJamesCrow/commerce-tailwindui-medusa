import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  useQueryGraphStep,
  sendNotificationsStep,
} from "@medusajs/medusa/core-flows"
import { type Address } from "../steps/format-order-for-email"

type SendAdminOrderAlertInput = {
  orderId: string
  adminEmails: string[]
  adminUrl: string
}

export const sendAdminOrderAlertWorkflow = createWorkflow(
  "send-admin-order-alert",
  function (input: SendAdminOrderAlertInput) {
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
        "item_total",
        "item_subtotal",
        "shipping_total",
        "tax_total",
        "discount_total",
      ],
      filters: { id: input.orderId },
    })

    // Single transform: collapse order lookup + formatting + notification building
    const notifications = transform(
      { orders, input } as { orders: Record<string, any>[]; input: SendAdminOrderAlertInput },
      ({ orders: result, input: inp }) => {
        const o = result[0] as Record<string, any>
        if (!o) return []

        // Format currency
        const currencyFormatter = new Intl.NumberFormat([], {
          style: "currency",
          currency: (o.currency_code as string) || "USD",
          currencyDisplay: "narrowSymbol",
        })
        const fmt = (amount: number) => currencyFormatter.format(amount)

        // Format items
        const items = ((o.items || []) as Record<string, any>[]).map((item) => ({
          name: (item.product_title || item.title) as string,
          variant: (item.variant_title as string) || undefined,
          quantity: item.quantity as number,
          price: fmt((item.total as number) ?? (item.unit_price as number) * (item.quantity as number)),
          imageUrl: (item.thumbnail as string) || undefined,
        }))

        // Format shipping address
        const sa = o.shipping_address as Record<string, any> | undefined
        const shippingAddress: Address = sa
          ? {
              name: `${sa.first_name || ""} ${sa.last_name || ""}`.trim(),
              line1: (sa.address_1 as string) || "",
              line2: (sa.address_2 as string) || undefined,
              city: (sa.city as string) || "",
              state: (sa.province as string) || undefined,
              postalCode: (sa.postal_code as string) || "",
              country: ((sa.country_code as string) || "").toUpperCase(),
              phone: (sa.phone as string) || undefined,
            }
          : { name: "", line1: "", city: "", postalCode: "", country: "" }

        // Format billing address
        const ba = o.billing_address as Record<string, any> | undefined
        const billingAddress: Address | undefined = ba
          ? {
              name: `${ba.first_name || ""} ${ba.last_name || ""}`.trim(),
              line1: (ba.address_1 as string) || "",
              line2: (ba.address_2 as string) || undefined,
              city: (ba.city as string) || "",
              state: (ba.province as string) || undefined,
              postalCode: (ba.postal_code as string) || "",
              country: ((ba.country_code as string) || "").toUpperCase(),
              phone: (ba.phone as string) || undefined,
            }
          : undefined

        const orderNumber = String(o.display_id || o.id)
        const orderDate = new Date(o.created_at as string).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        const total = fmt((o.total as number) || 0)

        return inp.adminEmails.map((adminEmail) => ({
          to: adminEmail,
          channel: "email" as const,
          template: "admin-order-alert",
          data: {
            subject: `New order #${orderNumber} — ${total}`,
            orderNumber,
            orderDate,
            customerEmail: o.email as string,
            customerName: sa?.first_name as string | undefined,
            items,
            subtotal: fmt(((o.item_subtotal ?? o.item_total) as number) ?? 0),
            shipping: fmt((o.shipping_total as number) || 0),
            tax: o.tax_total ? fmt(o.tax_total as number) : undefined,
            discount: o.discount_total ? fmt(o.discount_total as number) : undefined,
            total,
            shippingAddress,
            billingAddress,
            adminOrderUrl: `${inp.adminUrl}/orders/${o.id as string}`,
          },
          trigger_type: "order.placed",
          resource_id: o.id as string,
          resource_type: "order",
        }))
      }
    )

    sendNotificationsStep(notifications)

    return new WorkflowResponse({
      orderId: input.orderId,
    })
  }
)
