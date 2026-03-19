import { MedusaService } from "@medusajs/framework/utils"
import Invoice from "./models/invoice"
import InvoiceConfig from "./models/invoice-config"

class InvoiceModuleService extends MedusaService({
  Invoice,
  InvoiceConfig,
}) {
  /**
   * Get the next sequential display_id for the given year.
   * Concurrent calls may return the same value — callers must handle
   * unique constraint violations on [year, display_id] with retry logic.
   */
  async getNextDisplayId(year: number): Promise<number> {
    const invoices = await this.listInvoices(
      { year },
      { order: { display_id: "DESC" }, take: 1 }
    )
    const maxDisplayId = invoices[0]?.display_id ?? 0
    return maxDisplayId + 1
  }

  formatInvoiceNumber(year: number, displayId: number): string {
    return `INV-${year}-${String(displayId).padStart(4, "0")}`
  }
}

export default InvoiceModuleService
