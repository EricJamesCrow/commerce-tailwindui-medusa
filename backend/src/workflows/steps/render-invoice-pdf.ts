import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument } from "../../modules/invoice/templates/invoice-document";
import type { InvoiceDocumentProps } from "../../modules/invoice/templates/invoice-document";
import React from "react";

export const renderInvoicePdfStep = createStep(
  "render-invoice-pdf",
  async (props: InvoiceDocumentProps) => {
    const element = React.createElement(InvoiceDocument, props);
    const buffer = await renderToBuffer(element);
    return new StepResponse(buffer);
  },
);
