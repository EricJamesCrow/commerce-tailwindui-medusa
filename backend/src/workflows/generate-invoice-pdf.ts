import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { getOrCreateInvoiceStep } from "./steps/get-or-create-invoice";
import {
  formatInvoiceDataStep,
  type FormatInvoiceDataInput,
} from "./steps/format-invoice-data";
import { renderInvoicePdfStep } from "./steps/render-invoice-pdf";
import { trackAnalyticsEventStep } from "./steps/track-analytics-event";

type GenerateInvoicePdfInput = {
  order_id: string;
  delivery_method?: "attachment" | "link";
};

export const generateInvoicePdfWorkflow = createWorkflow(
  "generate-invoice-pdf",
  function (input: GenerateInvoicePdfInput) {
    // Step 1: Fetch order with all fields needed for invoice
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "customer_id",
        "email",
        "created_at",
        "currency_code",
        "total",
        "subtotal",
        "item_subtotal",
        "item_total",
        "shipping_total",
        "discount_total",
        "tax_total",
        "items.*",
        "shipping_address.*",
        "billing_address.*",
      ],
      filters: { id: input.order_id },
    });

    const order = transform({ orders }, ({ orders: result }) => {
      const o = result[0];
      if (!o) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found");
      }
      return o;
    });

    // Step 2: Fetch InvoiceConfig
    const { data: configs } = useQueryGraphStep({
      entity: "invoice_config",
      fields: [
        "id",
        "company_name",
        "company_address",
        "company_phone",
        "company_email",
        "company_logo",
        "tax_id",
        "notes",
        "attach_to_email",
      ],
    }).config({ name: "fetch-invoice-config" });

    const config = transform({ configs }, ({ configs: result }) => {
      const c = result[0];
      if (!c) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "Invoice configuration not found. Please configure invoice settings in the admin panel.",
        );
      }
      return c;
    });

    // Step 3: Get or create Invoice record
    const invoiceResult = getOrCreateInvoiceStep({
      order_id: input.order_id,
    });

    // Cast: Medusa TS2590 — WorkflowData union too complex to resolve nested step result types
    const invoice = transform(
      { invoiceResult },
      (data) => (data as any).invoiceResult.invoice,
    );

    // Step 4: Format data for PDF template
    // Cast to `any` to avoid TS2590 "union type too complex" from WorkflowData intersection
    const formatInput = transform(
      { order, invoice, config } as any,
      (data: any): FormatInvoiceDataInput => ({
        order: data.order,
        invoice: {
          display_id: data.invoice.display_id,
          year: data.invoice.year,
        },
        config: {
          company_name: data.config.company_name,
          company_address: data.config.company_address,
          company_phone: data.config.company_phone,
          company_email: data.config.company_email,
          company_logo: data.config.company_logo,
          tax_id: data.config.tax_id,
          notes: data.config.notes,
        },
      }),
    );

    const invoiceProps = formatInvoiceDataStep(formatInput);

    // Step 5: Render PDF buffer
    const buffer = renderInvoicePdfStep(invoiceProps);

    // Step 6: Track invoice_generated analytics event
    // Cast to `any` to avoid TS2590 "union type too complex" from WorkflowData intersection
    const trackingInput = transform(
      { order, invoice, input } as any,
      (data: any) => ({
        event: "invoice_generated",
        actor_id: data.order.customer_id ?? null,
        actor_fallback: `order_${data.input.order_id}`,
        properties: {
          order_id: data.input.order_id,
          invoice_number: `${data.invoice.year}-${data.invoice.display_id}`,
          delivery_method: data.input.delivery_method ?? "unknown",
        },
      }),
    );

    trackAnalyticsEventStep(trackingInput);

    return new WorkflowResponse({ buffer, invoice });
  },
);
