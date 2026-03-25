import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import * as Sentry from "@sentry/node";
import { INVOICE_MODULE } from "../../modules/invoice";
import type InvoiceModuleService from "../../modules/invoice/service";
import {
  getOrCreateInvoiceRecord,
  buildInvoiceDocumentProps,
} from "./_invoice-helpers";

type TryGenerateInvoicePdfInput = {
  order_id: string;
  order: Record<string, any>;
  delivery_method?: "attachment" | "link";
};

type TryGenerateInvoicePdfOutput = {
  buffer: Buffer | null;
  invoiceNumber: string | null;
};

/**
 * Resilient invoice PDF generation step.
 *
 * Wraps the entire invoice generation pipeline (get/create invoice record,
 * fetch config, format data, render PDF) in a try/catch so that failures
 * never propagate to the parent workflow. Returns `{ buffer: null }` on
 * any error, allowing the caller to fall back to link mode.
 */
export const tryGenerateInvoicePdfStep = createStep(
  "try-generate-invoice-pdf",
  async (
    input: TryGenerateInvoicePdfInput,
    { container },
  ): Promise<StepResponse<TryGenerateInvoicePdfOutput>> => {
    try {
      const invoiceService: InvoiceModuleService =
        container.resolve(INVOICE_MODULE);

      // 1. Get or create the invoice record
      const { invoice } = await getOrCreateInvoiceRecord(
        invoiceService,
        input.order_id,
      );

      // 2. Fetch invoice config
      const configs = await invoiceService.listInvoiceConfigs();
      const config = configs[0];
      if (!config) {
        console.warn(
          "[try-generate-invoice-pdf] InvoiceConfig not found, skipping attachment",
        );
        return new StepResponse({ buffer: null, invoiceNumber: null });
      }

      // 3. Format invoice data
      const props = buildInvoiceDocumentProps(
        invoiceService,
        input.order,
        invoice,
        config,
      );

      // 4. Render PDF — dynamic import to avoid loading @react-pdf/renderer
      //    in environments where it isn't available
      const React = await import("react");
      const { renderToBuffer } = await import("@react-pdf/renderer");
      const { InvoiceDocument } = await import(
        "../../modules/invoice/templates/invoice-document.js"
      );

      const element = React.createElement(InvoiceDocument, props);
      const buffer = await renderToBuffer(element);

      // Track invoice_generated (fire-and-forget, inside try block)
      try {
        const analytics = container.resolve(Modules.ANALYTICS);
        await analytics.track({
          event: "invoice_generated",
          // Cast: input.order typed as Record<string, any> — accessing known order fields
          // Use opaque fallback instead of email to avoid PII in analytics
          actor_id:
            (input.order as any).customer_id || `order_${input.order_id}`,
          properties: {
            order_id: input.order_id,
            invoice_number: props.invoiceNumber,
            delivery_method: input.delivery_method ?? "attachment",
          },
        });
      } catch {
        // Analytics module not registered or tracking failed — ignore
      }

      return new StepResponse({
        buffer: Buffer.from(buffer),
        invoiceNumber: props.invoiceNumber,
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { workflow_step: "try_generate_invoice_pdf" },
        level: "warning",
      });
      console.error(
        "[try-generate-invoice-pdf] Failed to generate invoice PDF, falling back to link mode:",
        error instanceof Error ? error.message : error,
      );
      return new StepResponse({ buffer: null, invoiceNumber: null });
    }
  },
);
