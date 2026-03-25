import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { INVOICE_MODULE } from "../../modules/invoice";
import type InvoiceModuleService from "../../modules/invoice/service";
import { getOrCreateInvoiceRecord } from "./_invoice-helpers";

export type GetOrCreateInvoiceInput = {
  order_id: string;
};

export const getOrCreateInvoiceStep = createStep(
  "get-or-create-invoice",
  async (input: GetOrCreateInvoiceInput, { container }) => {
    const invoiceService: InvoiceModuleService =
      container.resolve(INVOICE_MODULE);

    const { invoice, isNew } = await getOrCreateInvoiceRecord(
      invoiceService,
      input.order_id,
    );

    return new StepResponse(
      { invoice, isNew },
      // No compensation needed for existing invoices — pass empty string sentinel
      isNew ? invoice.id : "",
    );
  },
  async (invoiceId, { container }) => {
    if (!invoiceId) {
      return;
    }

    const invoiceService: InvoiceModuleService =
      container.resolve(INVOICE_MODULE);

    await invoiceService.softDeleteInvoices(invoiceId);
  },
);
