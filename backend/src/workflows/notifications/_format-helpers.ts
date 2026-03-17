/**
 * Shared formatting helpers for order/payment email workflows.
 *
 * These pure functions are used inside `transform()` callbacks and workflow steps
 * to format Medusa order data into email-friendly shapes.
 */

import type { Address } from "../steps/format-order-for-email"

/**
 * Create a currency formatter for Intl.NumberFormat.
 */
export function createCurrencyFormatter(currencyCode: string): Intl.NumberFormat {
  return new Intl.NumberFormat([], {
    style: "currency",
    currency: currencyCode || "USD",
    currencyDisplay: "narrowSymbol",
  })
}

/**
 * Format a Medusa order item into email-friendly shape.
 */
export function formatItem(
  item: Record<string, any>,
  formatMoney: (amount: number) => string
): { name: string; variant?: string; quantity: number; price: string; imageUrl?: string } {
  return {
    name: (item.product_title || item.title) as string,
    variant: (item.variant_title as string) || undefined,
    quantity: item.quantity as number,
    price: formatMoney((item.total as number) ?? (item.unit_price as number) * (item.quantity as number)),
    imageUrl: (item.thumbnail as string) || undefined,
  }
}

/**
 * Format a Medusa address record into the Address shape used by email templates.
 */
export function formatAddress(raw: Record<string, any> | undefined | null): Address {
  if (!raw) {
    return { name: "", line1: "", city: "", postalCode: "", country: "" }
  }

  return {
    name: `${raw.first_name || ""} ${raw.last_name || ""}`.trim(),
    line1: (raw.address_1 as string) || "",
    line2: (raw.address_2 as string) || undefined,
    city: (raw.city as string) || "",
    state: (raw.province as string) || undefined,
    postalCode: (raw.postal_code as string) || "",
    country: ((raw.country_code as string) || "").toUpperCase(),
    phone: (raw.phone as string) || undefined,
  }
}

/**
 * Format a date string into a human-readable format (e.g., "March 14, 2026").
 */
export function formatOrderDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
