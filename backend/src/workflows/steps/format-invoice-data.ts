import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { INVOICE_MODULE } from "../../modules/invoice"
import type InvoiceModuleService from "../../modules/invoice/service"
import {
  createCurrencyFormatter,
  formatAddress,
  formatOrderDate,
} from "../notifications/_format-helpers"
import type { InvoiceDocumentProps } from "../../modules/invoice/templates/invoice-document"

export type FormatInvoiceDataInput = {
  order: Record<string, any>
  invoice: { display_id: number; year: number }
  config: {
    company_name: string
    company_address: string
    company_phone?: string | null
    company_email: string
    company_logo?: string | null
    tax_id?: string | null
    notes?: string | null
  }
}

export const formatInvoiceDataStep = createStep(
  "format-invoice-data",
  async (input: FormatInvoiceDataInput, { container }) => {
    const invoiceService: InvoiceModuleService =
      container.resolve(INVOICE_MODULE)
    const { order, invoice, config } = input

    const fmt = createCurrencyFormatter(order.currency_code || "USD")
    const formatMoney = (amount: number) => fmt.format(amount)

    const invoiceNumber = invoiceService.formatInvoiceNumber(
      invoice.year,
      invoice.display_id
    )
    const address = formatAddress(
      order.shipping_address || order.billing_address
    )

    const props: InvoiceDocumentProps = {
      invoiceNumber,
      issuedDate: formatOrderDate(order.created_at),
      orderDisplayId: `#${order.display_id || order.id}`,
      company: {
        name: config.company_name,
        address: config.company_address,
        phone: config.company_phone || undefined,
        email: config.company_email,
        logo: config.company_logo || undefined,
        taxId: config.tax_id || undefined,
      },
      customer: {
        name: address.name || order.email,
        address: [
          address.line1,
          address.line2,
          `${address.city}, ${address.state || ""} ${address.postalCode}`.trim(),
          address.country,
        ]
          .filter(Boolean)
          .join("\n"),
        email: order.email,
      },
      items: ((order.items || []) as Record<string, any>[]).map((item) => ({
        name: (item.product_title || item.title) as string,
        variant: (item.variant_title as string) || undefined,
        sku: (item.variant_sku as string) || undefined,
        quantity: item.quantity as number,
        unitPrice: formatMoney(item.unit_price as number),
        total: formatMoney(
          (item.total as number) ??
            (item.unit_price as number) * (item.quantity as number)
        ),
      })),
      subtotal: formatMoney(order.item_subtotal ?? order.subtotal ?? 0),
      shipping: formatMoney(order.shipping_total || 0),
      discount: order.discount_total
        ? formatMoney(order.discount_total)
        : undefined,
      tax: formatMoney(order.tax_total || 0),
      total: formatMoney(order.total || 0),
      currency: order.currency_code || "USD",
      notes: config.notes || undefined,
    }

    return new StepResponse(props)
  }
)
