import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { INVOICE_MODULE } from "../../modules/invoice";
import type InvoiceModuleService from "../../modules/invoice/service";
import {
  buildInvoiceDocumentProps,
  type InvoiceConfigData,
} from "./_invoice-helpers";

export type FormatInvoiceDataInput = {
  order: Record<string, any>;
  invoice: { display_id: number; year: number };
  config: InvoiceConfigData;
};

export const formatInvoiceDataStep = createStep(
  "format-invoice-data",
  async (input: FormatInvoiceDataInput, { container }) => {
    const invoiceService: InvoiceModuleService =
      container.resolve(INVOICE_MODULE);

    const props = buildInvoiceDocumentProps(
      invoiceService,
      input.order,
      input.invoice,
      input.config,
    );

    return new StepResponse(props);
  },
);
