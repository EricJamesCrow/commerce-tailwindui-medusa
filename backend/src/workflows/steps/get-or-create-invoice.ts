import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { INVOICE_MODULE } from "../../modules/invoice"
import type InvoiceModuleService from "../../modules/invoice/service"

export type GetOrCreateInvoiceInput = {
  order_id: string
}

export const getOrCreateInvoiceStep = createStep(
  "get-or-create-invoice",
  async (input: GetOrCreateInvoiceInput, { container }) => {
    const invoiceService: InvoiceModuleService =
      container.resolve(INVOICE_MODULE)

    const existing = await invoiceService.listInvoices({
      order_id: input.order_id,
    })

    if (existing[0]) {
      // No compensation needed for existing invoices — pass empty string sentinel
      return new StepResponse(
        { invoice: existing[0], isNew: false },
        ""
      )
    }

    const year = new Date().getFullYear()
    const displayId = await invoiceService.getNextDisplayId(year)

    try {
      const invoice = await invoiceService.createInvoices({
        display_id: displayId,
        order_id: input.order_id,
        year,
        generated_at: new Date(),
      })

      return new StepResponse(
        { invoice, isNew: true },
        invoice.id
      )
    } catch {
      // Retry once on unique constraint violation (race condition on display_id)
      const retryDisplayId = await invoiceService.getNextDisplayId(year)
      const invoice = await invoiceService.createInvoices({
        display_id: retryDisplayId,
        order_id: input.order_id,
        year,
        generated_at: new Date(),
      })

      return new StepResponse(
        { invoice, isNew: true },
        invoice.id
      )
    }
  },
  async (invoiceId, { container }) => {
    if (!invoiceId) {
      return
    }

    const invoiceService: InvoiceModuleService =
      container.resolve(INVOICE_MODULE)

    await invoiceService.softDeleteInvoices(invoiceId)
  }
)
