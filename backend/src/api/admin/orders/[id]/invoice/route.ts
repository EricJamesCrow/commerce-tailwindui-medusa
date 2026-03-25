import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { generateInvoicePdfWorkflow } from "../../../../../workflows/generate-invoice-pdf";
import { INVOICE_MODULE } from "../../../../../modules/invoice";
import type InvoiceModuleService from "../../../../../modules/invoice/service";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const orderId = req.params.id;

  const query = req.scope.resolve("query");
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "items.id"],
    filters: { id: orderId },
  });

  const order = orders[0];
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found");
  }
  if (!order.items || order.items.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cannot generate invoice for an order with no items",
    );
  }

  const { result } = await generateInvoicePdfWorkflow(req.scope).run({
    input: { order_id: orderId, delivery_method: "link" },
  });

  const invoiceService: InvoiceModuleService =
    req.scope.resolve(INVOICE_MODULE);
  const invoiceNumber = invoiceService.formatInvoiceNumber(
    result.invoice.year,
    result.invoice.display_id,
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${invoiceNumber}.pdf"`,
  );
  res.send(Buffer.from(result.buffer));
};
