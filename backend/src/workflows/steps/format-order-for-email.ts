import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"

export type Address = {
  name: string
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string
  phone?: string
}

export type FormattedOrderEmailData = {
  orderId: string
  orderNumber: string
  email: string
  customerName?: string
  orderDate: string
  items: {
    name: string
    variant?: string
    quantity: number
    price: string
    imageUrl?: string
  }[]
  subtotal: string
  shipping: string
  tax?: string
  discount?: string
  total: string
  paymentMethod: string
  shippingAddress: Address
}

type FormatOrderForEmailInput = {
  order: Record<string, any>
}

export const formatOrderForEmailStep = createStep(
  "format-order-for-email",
  async (input: FormatOrderForEmailInput) => {
    const { order } = input

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
      price: formatMoney(item.total ?? item.unit_price * item.quantity),
      imageUrl: item.thumbnail || undefined,
    }))

    const shippingAddress: Address = order.shipping_address
      ? {
          name: `${order.shipping_address.first_name || ""} ${order.shipping_address.last_name || ""}`.trim(),
          line1: order.shipping_address.address_1 || "",
          line2: order.shipping_address.address_2 || undefined,
          city: order.shipping_address.city || "",
          state: order.shipping_address.province || undefined,
          postalCode: order.shipping_address.postal_code || "",
          country:
            order.shipping_address.country_code?.toUpperCase() || "",
          phone: order.shipping_address.phone || undefined,
        }
      : {
          name: "",
          line1: "",
          city: "",
          postalCode: "",
          country: "",
        }

    const orderDate = new Date(order.created_at).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    )

    const formatted: FormattedOrderEmailData = {
      orderId: order.id,
      orderNumber: String(order.display_id || order.id),
      email: order.email,
      customerName: order.shipping_address?.first_name || undefined,
      orderDate,
      items,
      subtotal: formatMoney(order.item_subtotal ?? order.item_total ?? 0),
      shipping: formatMoney(order.shipping_total || 0),
      tax: order.tax_total ? formatMoney(order.tax_total) : undefined,
      discount: order.discount_total
        ? formatMoney(order.discount_total)
        : undefined,
      total: formatMoney(order.total || 0),
      paymentMethod: "Card",
      shippingAddress,
    }

    return new StepResponse(formatted)
  }
)
