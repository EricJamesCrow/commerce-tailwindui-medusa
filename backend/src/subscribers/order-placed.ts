import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    const query = container.resolve("query")
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)

    const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "created_at",
      "currency_code",
      "items.id",
      "items.title",
      "items.product_title",
      "items.variant_title",
      "items.quantity",
      "items.unit_price",
      "items.thumbnail",
      "shipping_address.*",
      "billing_address.*",
      "item_total",
      "shipping_total",
      "tax_total",
      "discount_total",
      "total",
    ],
    filters: { id: data.id },
  })

  if (!order?.email) {
    logger.warn(
      `Order ${data.id} has no email address, skipping confirmation email`
    )
    return
  }

  const currencyFormatter = new Intl.NumberFormat([], {
    style: "currency",
    currency: order.currency_code || "USD",
    currencyDisplay: "narrowSymbol",
  })

  const formatMoney = (amount: number) => currencyFormatter.format(amount)

  const items = (order.items || []).map((item: any) => ({
    name: item.product_title || item.title,
    variant: item.variant_title || undefined,
    quantity: item.quantity,
    price: formatMoney(item.unit_price * item.quantity),
    imageUrl: item.thumbnail || undefined,
  }))

  const shippingAddress = order.shipping_address
    ? {
        name: `${order.shipping_address.first_name || ""} ${order.shipping_address.last_name || ""}`.trim(),
        line1: order.shipping_address.address_1 || "",
        line2: order.shipping_address.address_2 || undefined,
        city: order.shipping_address.city || "",
        state: order.shipping_address.province || undefined,
        postalCode: order.shipping_address.postal_code || "",
        country: order.shipping_address.country_code?.toUpperCase() || "",
        phone: order.shipping_address.phone || undefined,
      }
    : {
        name: "",
        line1: "",
        city: "",
        postalCode: "",
        country: "",
      }

  const orderDate = new Date(order.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const storefrontUrl = process.env.STOREFRONT_URL || "http://localhost:3000"

  await notificationModuleService.createNotifications({
    to: order.email,
    channel: "email",
    template: "order-confirmation",
    data: {
      subject: `Order Confirmed - #${order.display_id || order.id}`,
      customerName: order.shipping_address?.first_name || undefined,
      orderNumber: String(order.display_id || order.id),
      orderDate,
      items,
      subtotal: formatMoney(order.item_total || 0),
      shipping: formatMoney(order.shipping_total || 0),
      tax: order.tax_total ? formatMoney(order.tax_total) : undefined,
      discount: order.discount_total ? formatMoney(order.discount_total) : undefined,
      total: formatMoney(order.total || 0),
      paymentMethod: "Card",
      shippingAddress,
      orderStatusUrl: `${storefrontUrl}/account/orders/${order.id}`,
    },
  })

  logger.info(`Order confirmation email sent for order ${order.id}`)
  } catch (error) {
    logger.error(`Failed to send order confirmation email for order ${data.id}`, error)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
