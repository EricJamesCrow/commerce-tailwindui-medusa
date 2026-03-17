import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createCurrencyFormatter,
  formatAddress,
  formatItem,
  formatOrderDate,
} from "../notifications/_format-helpers"

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

    const fmt = createCurrencyFormatter(order.currency_code || "USD")
    const formatMoney = (amount: number) => fmt.format(amount)

    const items = ((order.items || []) as Record<string, any>[]).map(
      (item) => formatItem(item, formatMoney)
    )

    const formatted: FormattedOrderEmailData = {
      orderId: order.id,
      orderNumber: String(order.display_id || order.id),
      email: order.email,
      customerName: order.shipping_address?.first_name || undefined,
      orderDate: formatOrderDate(order.created_at),
      items,
      subtotal: formatMoney(order.item_subtotal ?? order.item_total ?? 0),
      shipping: formatMoney(order.shipping_total || 0),
      tax: order.tax_total ? formatMoney(order.tax_total) : undefined,
      discount: order.discount_total
        ? formatMoney(order.discount_total)
        : undefined,
      total: formatMoney(order.total || 0),
      paymentMethod: "Card",
      shippingAddress: formatAddress(order.shipping_address),
    }

    return new StepResponse(formatted)
  }
)
