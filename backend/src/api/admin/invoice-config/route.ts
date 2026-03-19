import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { INVOICE_MODULE } from "../../../modules/invoice"
import type InvoiceModuleService from "../../../modules/invoice/service"
import { z } from "@medusajs/framework/zod"

export const PostAdminInvoiceConfigSchema = z.object({
  company_name: z.string().min(1),
  company_address: z.string().min(1),
  company_phone: z.string().nullable().optional(),
  company_email: z.string().email(),
  company_logo: z.string().url().nullable().optional(),
  tax_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  attach_to_email: z.boolean().optional(),
})

export type PostAdminInvoiceConfigReq = z.infer<
  typeof PostAdminInvoiceConfigSchema
>

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const invoiceService: InvoiceModuleService =
    req.scope.resolve(INVOICE_MODULE)
  const configs = await invoiceService.listInvoiceConfigs()

  res.json({ invoice_config: configs[0] || null })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<PostAdminInvoiceConfigReq>,
  res: MedusaResponse
) => {
  const invoiceService: InvoiceModuleService =
    req.scope.resolve(INVOICE_MODULE)
  const body = req.validatedBody

  // Upsert: update existing or create new (singleton pattern)
  const existing = await invoiceService.listInvoiceConfigs()

  let config
  if (existing[0]) {
    config = await invoiceService.updateInvoiceConfigs({
      id: existing[0].id,
      ...body,
    })
  } else {
    config = await invoiceService.createInvoiceConfigs(body)
  }

  res.json({ invoice_config: config })
}
