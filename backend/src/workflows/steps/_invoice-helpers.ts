import type InvoiceModuleService from "../../modules/invoice/service";
import {
  createCurrencyFormatter,
  formatAddress,
  formatOrderDate,
} from "../notifications/_format-helpers";
import type { InvoiceDocumentProps } from "../../modules/invoice/templates/invoice-document";

export type InvoiceConfigData = {
  company_name: string;
  company_address: string;
  company_phone?: string | null;
  company_email: string;
  company_logo?: string | null;
  tax_id?: string | null;
  notes?: string | null;
};

/**
 * Get an existing invoice for the order, or create a new one.
 * Retries once on unique constraint violations (race on display_id).
 */
export async function getOrCreateInvoiceRecord(
  invoiceService: InvoiceModuleService,
  orderId: string,
) {
  const existing = await invoiceService.listInvoices({
    order_id: orderId,
  });

  if (existing[0]) {
    return { invoice: existing[0], isNew: false };
  }

  const year = new Date().getFullYear();
  const displayId = await invoiceService.getNextDisplayId(year);

  try {
    const invoice = await invoiceService.createInvoices({
      display_id: displayId,
      order_id: orderId,
      year,
      generated_at: new Date(),
    });
    return { invoice, isNew: true };
  } catch (error: unknown) {
    // Only retry on unique constraint violations (Postgres error code 23505)
    const isUniqueViolation =
      error instanceof Error &&
      (("code" in error && (error as { code: string }).code === "23505") ||
        error.message.includes("unique") ||
        error.message.includes("duplicate"));
    if (!isUniqueViolation) throw error;

    const retryDisplayId = await invoiceService.getNextDisplayId(year);
    const invoice = await invoiceService.createInvoices({
      display_id: retryDisplayId,
      order_id: orderId,
      year,
      generated_at: new Date(),
    });
    return { invoice, isNew: true };
  }
}

/**
 * Build InvoiceDocumentProps from order, invoice, and config data.
 */
export function buildInvoiceDocumentProps(
  invoiceService: InvoiceModuleService,
  order: Record<string, any>,
  invoice: { display_id: number; year: number },
  config: InvoiceConfigData,
): InvoiceDocumentProps {
  const fmt = createCurrencyFormatter(order.currency_code || "USD");
  const formatMoney = (amount: number): string => fmt.format(amount);

  const invoiceNumber = invoiceService.formatInvoiceNumber(
    invoice.year,
    invoice.display_id,
  );
  const address = formatAddress(
    order.shipping_address || order.billing_address,
  );

  return {
    invoiceNumber,
    issuedDate: formatOrderDate(order.created_at),
    orderDisplayId: `#${order.display_id || order.id}`,
    company: {
      name: config.company_name,
      address: config.company_address,
      phone: config.company_phone || undefined,
      email: config.company_email,
      logo: config.company_logo || undefined,
      taxId: config.tax_id || undefined,
    },
    customer: {
      name: address.name || order.email,
      address: [
        address.line1,
        address.line2,
        `${address.city}, ${address.state || ""} ${address.postalCode}`.trim(),
        address.country,
      ]
        .filter(Boolean)
        .join("\n"),
      email: order.email,
    },
    items: ((order.items || []) as Record<string, any>[]).map((item) => ({
      name: (item.product_title || item.title) as string,
      variant: (item.variant_title as string) || undefined,
      sku: (item.variant_sku as string) || undefined,
      thumbnail: (item.thumbnail as string) || undefined,
      quantity: item.quantity as number,
      unitPrice: formatMoney(item.unit_price as number),
      total: formatMoney(
        (item.total as number) ??
          (item.unit_price as number) * (item.quantity as number),
      ),
    })),
    subtotal: formatMoney(order.item_subtotal ?? order.subtotal ?? 0),
    shipping: formatMoney(order.shipping_total || 0),
    discount: order.discount_total
      ? formatMoney(order.discount_total)
      : undefined,
    tax: formatMoney(order.tax_total || 0),
    total: formatMoney(order.total || 0),
    currency: order.currency_code || "USD",
    notes: config.notes || undefined,
  };
}
