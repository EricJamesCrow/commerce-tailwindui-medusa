import { model } from "@medusajs/framework/utils"

const InvoiceConfig = model.define("invoice_config", {
  id: model.id().primaryKey(),
  company_name: model.text(),
  company_address: model.text(),
  company_phone: model.text().nullable(),
  company_email: model.text(),
  company_logo: model.text().nullable(),
  tax_id: model.text().nullable(),
  notes: model.text().nullable(),
  attach_to_email: model.boolean().default(false),
})

export default InvoiceConfig
