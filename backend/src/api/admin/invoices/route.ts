import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { INVOICE_MODULE } from "../../../modules/invoice";
import type InvoiceModuleService from "../../../modules/invoice/service";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const invoiceService: InvoiceModuleService =
    req.scope.resolve(INVOICE_MODULE);

  const filters: Record<string, unknown> = {};
  if (req.query.order_id) {
    filters.order_id = req.query.order_id;
  }

  const invoices = await invoiceService.listInvoices(filters);

  res.json({ invoices });
};
